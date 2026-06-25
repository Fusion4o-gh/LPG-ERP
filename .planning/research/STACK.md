# Stack Research: Warehouse Cylinder Tracking & KG Pricing

**Domain:** LPG cylinder distribution ERP — multi-warehouse inventory + per-kilogram pricing extension
**Researched:** 2026-06-25
**Confidence:** HIGH

## Executive Summary

This document prescribes how to extend an existing Next.js 15 / Prisma 6 / PostgreSQL 16 LPG ERP with **multi-warehouse cylinder stock tracking** (leveraging the existing `StockLocation` model where `type = WAREHOUSE`) and **KG-based pricing** (adding `pricePerKg` to `ItemPrice` with an auto-compute formula). The core insight: the existing `BulkStockLedgerEntry` already demonstrates the location-scoped ledger pattern at scale — the same approach applies to the cylinder `StockLedgerEntry`. KG pricing is a schema change + calculation override that coexists with the existing per-cylinder price.

**Key decisions:**
1. Add `locationId` (nullable) to `StockLedgerEntry` — same pattern as `BulkStockLedgerEntry.locationId`
2. Compute `balanceAfter` per `(companyId, itemId, cylinderState, locationId)` — not globally
3. Add `pricePerKg` to `ItemPrice` — auto-calc = `pricePerKg × cylinderWeightKg × quantity`
4. Warehouse selector as both app-shell context and per-form field — mirroring financial-year navigation pattern
5. No new runtime dependencies — all work uses existing stack

---

## Recommended Stack

### Core Technologies

The project **already owns** the full stack. No new core technologies are required. What follows are the specific patterns and schema extensions to use.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js 15 App Router | 15.5.x | Application framework | Already in production — server components for warehouse layout, route handlers for API |
| React 19 | 19.x | UI layer | Already in production — client components for warehouse selector and KG price fields |
| Prisma 6 | 6.19.x | ORM + migrations | Already in production — schema changes for `locationId` on `StockLedgerEntry` and `pricePerKg` on `ItemPrice` |
| PostgreSQL 16 | 16.x | Database | Already in production — composite partial indexes, row-level security for multi-warehouse, `UNION ALL` for cross-warehouse stock queries |
| Tailwind CSS 3 | 3.4.x | Styling | Already in production — no new UI library needed for warehouse selector or KG price display |

### Supporting Patterns (Not Libraries)

| Pattern | Source | Purpose | When to Use |
|---------|--------|---------|-------------|
| Location-scoped balance computation | `BulkStockLedgerEntry` (existing) | Compute `balanceAfter` per `(companyId, itemId, cylinderState, locationId)` | Every cylinder stock movement in a transaction |
| Append-only stock ledger | `StockLedgerEntry` (existing) | Immutable movement history — never UPDATE or DELETE | All stock operations |
| Atomic two-sided warehouse transfer | `BulkStockLedgerEntry` inbound/outbound pattern | Debit source, credit destination in one Prisma `$transaction` | Inter-warehouse cylinder transfers |
| Warehouse context via app-shell | FinancialYear selector (existing pattern) | Persist selected warehouse in user preferences; scope all queries | Session-level warehouse filter |
| KG price auto-calculation | `Item.cylinderWeightKg` × `ItemPrice.pricePerKg` × `quantity` | Derive per-unit price from weight-based rate | Purchase and sale transaction forms |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Prisma Studio | Visual schema inspection during migration development | Run `npx prisma studio` to verify location and price data |

## Installation

No new npm packages. The work is exclusively schema migrations and service-layer code.

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add-warehouse-location-stock-ledger
npx prisma migrate dev --name add-kg-pricing-to-item-price
```

---

## Schema Extension Plan

### 1. Add Warehouse Location to StockLedgerEntry

Extend the existing `StockLedgerEntry` model. Follow the exact pattern used by `BulkStockLedgerEntry.locationId`:

```prisma
// --- ON EXISTING MODEL StockLedgerEntry ---

model StockLedgerEntry {
  // ...existing fields...
  locationId String?   // NEW — nullable for backwards compat with existing data

  location StockLocation? @relation(fields: [locationId], references: [id]) // NEW

  // Update index: add locationId for location-scoped queries
  @@index([companyId, itemId, cylinderState, locationId, transactionDate])
}
```

**Critical constraints:**
- `locationId` is **nullable** — existing entries have no location (implicitly "main plant"). New entries from warehouse-aware features MUST provide it.
- The existing `@@index([companyId, itemId, cylinderState, transactionDate])` stays; the new composite index above gets **added** — do NOT remove the old one until all queries are migrated.
- `balanceAfter` computation changes from `(companyId, itemId, cylinderState)` → `(companyId, itemId, cylinderState, locationId)`. When `locationId` is NULL, balance is computed as before (global). This preserves backward compatibility.

### 2. Add WAREHOUSE Type Handling to StockLocation

The `StockLocation` model already has `type WAREHOUSE` in the enum and the model exists. No schema change needed. But verify:
- `StockLocation` already has `companyId`, `code`, `name`, `type`, `status`
- The existing `companyId + code` unique constraint already enforces per-company warehouse code uniqueness

**Seed or migrate:** Add a `type = WAREHOUSE` location for each existing company if none exists, or let users create warehouses through the existing location management UI.

### 3. Add KG Pricing to ItemPrice

Extend `ItemPrice`:

```prisma
model ItemPrice {
  // ...existing fields...
  pricePerKg Decimal? @db.Decimal(14, 4)   // NEW — nullable, price per KG
}
```

**Design rationale:**
- `pricePerKg` is nullable — existing records use only `price` (fixed per-cylinder). New records can use either or both.
- Precision `Decimal(14, 4)` allows fractional KG rates common in commodity pricing (e.g., PKR 285.50/kg).
- The computation logic lives in the **service layer**, not the database: when `pricePerKg` is set AND `item.cylinderWeightKg` is set, the derived per-cylinder price = `pricePerKg × cylinderWeightKg`. The service then uses this derived price the same way it uses a direct `price`.
- For reporting: store both the computed total AND the KG rate reference in the voucher/transaction record. Do NOT recompute from item weight at query time — weight may change later.

### 4. Warehouse Transfer Model

New model for warehouse-to-warehouse movements:

```prisma
enum TransferStatus {
  DRAFT
  COMPLETED
  CANCELLED
}

model CylinderTransfer {
  id              String          @id @default(cuid())
  companyId       String
  financialYearId String
  documentNo      String          @unique
  transferDate    DateTime        @db.Date
  sourceLocationId  String
  destinationLocationId String
  status          TransferStatus  @default(DRAFT)
  remarks         String?
  createdById     String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  lines CylinderTransferLine[]
}

model CylinderTransferLine {
  id                  String        @id @default(cuid())
  transferId          String
  itemId              String
  cylinderState       CylinderState
  quantity            Int
  remarks             String?

  transfer CylinderTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
}
```

**Why a new model instead of just using StockLedgerEntry?**
- Grouping: a transfer is a single business document with multiple line items (different cylinder types/states)
- Atomicity: all lines transfer in one transaction — no partial transfer scenario
- Audit trail: the transfer document is the source of truth; the two stock ledger entries (OUT from source, IN to destination) reference it via `sourceType` and `sourceId`

---

## Service Layer Patterns

### Pattern 1: Location-Scoped Stock Ledger Entry

Extend `createStockLedgerEntry` to accept and validate `locationId`. The balance computation must be scoped to the location.

```typescript
// src/server/services/inventory/stock-ledger.ts

type StockLedgerInput = {
  // ...existing fields...
  locationId?: string;  // NEW
};

export async function createStockLedgerEntry(tx: Tx, input: StockLedgerInput) {
  // ...existing validations...

  // Compute balance scoped to (itemId, cylinderState, locationId)
  const previous = await tx.stockLedgerEntry.findFirst({
    where: {
      companyId: input.companyId,
      itemId: input.itemId,
      cylinderState: input.cylinderState,
      locationId: input.locationId ?? null,  // NULL matches NULL
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    select: { balanceAfter: true },
  });

  const signedQuantity = input.direction === StockDirection.IN ? input.quantity : -input.quantity;
  const balanceAfter = (previous?.balanceAfter ?? 0) + signedQuantity;

  // Stock availability check is now per-location, not global
  // (existing stockAvailableCheck logic applies)
  if (company?.stockAvailableCheck && balanceAfter < 0) {
    throw new Error(`Insufficient stock at this location for this cylinder movement.`);
  }

  return tx.stockLedgerEntry.create({
    data: { /* ...existing + locationId: input.locationId */ },
  });
}
```

### Pattern 2: Location-Scoped Stock Availability

Modify `getFilledStockByItem` (and the new `getFilledStockByItemAtLocation`) to accept an optional `locationId`:

```typescript
export async function getFilledStockByItem(
  tx: Tx,
  input: { companyId: string; financialYearId: string; itemIds: string[]; locationId?: string },
) {
  const rows = await tx.stockLedgerEntry.groupBy({
    by: ["itemId", "direction"],
    where: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: { in: input.itemIds },
      cylinderState: CylinderState.FILLED,
      locationId: input.locationId,  // undefined = all locations, specific = filtered
    },
    _sum: { quantity: true },
  });
  // ...same signed sum logic...
}
```

**Why pass `locationId` as a filter instead of computing per-location balance always?**
- The existing sale flow that doesn't care about location (all sales from "the plant") continues to work without change
- The new flow (warehouse-aware sales/purchases) passes locationId and gets correct per-location stock
- Backward compatibility: `undefined` in WHERE = no filter = all locations

### Pattern 3: Atomic Warehouse Transfer

```typescript
export async function transferCylindersBetweenWarehouses(
  tx: Tx,
  input: {
    companyId: string;
    financialYearId: string;
    userId: string;
    transferDate: string | Date;
    sourceLocationId: string;
    destinationLocationId: string;
    lines: { itemId: string; cylinderState: CylinderState; quantity: number }[];
  },
) {
  // Validate source !== destination
  if (input.sourceLocationId === input.destinationLocationId) {
    throw new Error("Source and destination warehouse must be different.");
  }

  // Create the transfer document
  const transfer = await tx.cylinderTransfer.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      documentNo: /* next number */,
      transferDate: input.transferDate,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      createdById: input.userId,
      lines: {
        create: input.lines.map((line) => ({
          itemId: line.itemId,
          cylinderState: line.cylinderState,
          quantity: line.quantity,
        })),
      },
    },
  });

  // TWO stock ledger entries per line: OUT from source, IN to destination
  for (const line of input.lines) {
    // 1. OUT from source warehouse
    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.TRANSFER,  // Add this to enum
      sourceId: transfer.documentNo,
      transactionDate: input.transferDate,
      quantity: line.quantity,
      createdById: input.userId,
      locationId: input.sourceLocationId,
      remarks: `Transferred to ${input.destinationLocationId}`,
    });

    // 2. IN to destination warehouse
    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.TRANSFER,
      sourceId: transfer.documentNo,
      transactionDate: input.transferDate,
      quantity: line.quantity,
      createdById: input.userId,
      locationId: input.destinationLocationId,
      remarks: `Received from ${input.sourceLocationId}`,
    });
  }

  return transfer;
}
```

**Why two separate ledger entries per line?**
- Each entry produces its own `balanceAfter` scoped to its location
- Compliance with the append-only invariant: no correcting a single entry
- Same pattern as the existing `BulkStockLedgerEntry` for bulk stock transfers

### Pattern 4: KG Pricing Calculation

```typescript
// In sale-lpg.ts or a shared pricing utility

async function resolveItemPrice(
  tx: Tx,
  input: {
    companyId: string;
    itemId: string;
    customerId?: string;
    transactionDate: Date;
  },
): Promise<{ unitPrice: Prisma.Decimal; pricePerKg: Prisma.Decimal | null; cylinderWeightKg: Prisma.Decimal | null }> {
  // Find the applicable ItemPrice (customer-specific or default, date-effective)
  const itemPrice = await tx.itemPrice.findFirst({
    where: {
      itemId: input.itemId,
      customerId: input.customerId ?? null,  // null = default price
      validFrom: { lte: input.transactionDate },
      OR: [
        { validTo: null },
        { validTo: { gte: input.transactionDate } },
      ],
    },
    orderBy: [{ customerId: "desc" }, { validFrom: "desc" }], // customer-specific first
    include: { item: { select: { cylinderWeightKg: true } } },
  });

  if (!itemPrice) throw new Error(`No price found for item ${input.itemId}`);

  // If pricePerKg is set and cylinderWeightKg is known, derive unit price
  if (itemPrice.pricePerKg && itemPrice.item.cylinderWeightKg) {
    const derivedPrice = new Prisma.Decimal(itemPrice.pricePerKg).times(itemPrice.item.cylinderWeightKg);
    return {
      unitPrice: derivedPrice,
      pricePerKg: itemPrice.pricePerKg,
      cylinderWeightKg: itemPrice.item.cylinderWeightKg,
    };
  }

  // Fall back to fixed per-cylinder price
  return {
    unitPrice: itemPrice.price,
    pricePerKg: null,
    cylinderWeightKg: itemPrice.item.cylinderWeightKg,
  };
}
```

**KG pricing display (store derived price at transaction time):**

When creating the accounting voucher / invoice line, always store the **actual per-cylinder price used** (whether derived or direct). Never recompute from KG at read time — the weight or KG price may change later.

```typescript
// In the sale/purchase line record
{
  unitPrice: derivedUnitPrice,  // The actual per-cylinder price used
  pricePerKg: pricePerKg,       // Reference for display ("@ PKR 285/KG")
  cylinderWeightKg: weightKg,   // For display ("12.5 KG cylinder")
  // ... other fields
}
```

---

## UI Patterns

### Pattern 1: Warehouse Context Selector

**Location:** App shell top bar (alongside financial year selector)

```
┌──────────────────────────────────────────────────┐
│  Fin Year: 2025-2026 ▼  │  Warehouse: Main ▼  │
├──────────────────────────────────────────────────┤
```

**Behavior:**
- Default: "All Warehouses" (or user's default warehouse from preferences)
- Selection persisted in user preferences (same pattern as `uiTheme` on `User` model)
- All list views (stock ledger, inventory reports) filter by selected warehouse
- Transaction forms (sale, purchase) show selected warehouse as default, with per-form override

**Implementation:**
- New `defaultLocationId` nullable field on the `User` model (or use existing preferences mechanism)
- Server context passes selected location alongside `companyId`/`financialYearId` from session
- Client: controlled dropdown fetching from `/api/locations?type=WAREHOUSE`

### Pattern 2: Warehouse Field on Transaction Forms

```
Sale LPG Form
┌────────────────────────────────────────────┐
│ Warehouse:  [Main Warehouse ▼]   [Stock: 45]│
│ Customer:   [Search...                  ▼] │
│ Item:       [12.5 KG Cylinder          ▼] │
│ Quantity:   [10                       ■■] │
│ Price:      [3,425.00 ]  @ [285.50/KG ▼]  │
└────────────────────────────────────────────┘
```

**Key UX decisions:**
- Show available stock for the selected warehouse in the dropdown option text (e.g., "Main Warehouse - 45 Filled")
- KG price toggle: when `pricePerKg` is set, show both per-cylinder price AND per-KG rate. The per-cylinder price is auto-computed and read-only.
- Warehouse field on a sale/purchase form is a required dropdown with search — matching the existing Dynamics-365-style searchable dropdown pattern.

### Pattern 3: Stock Ledger View with Location Column

```
Stock Ledger — Main Warehouse (filtered)
┌──────┬────────┬──────────┬──────┬───────┬──────────┐
│ Date │ Item   │ Filled   │ Qty  │ Bal.  │ Location │
├──────┼────────┼──────────┼──────┼───────┼──────────┤
│ 24/6 │ 12.5KG │ OUT      │ -5   │ 40    │ Main     │
│ 24/6 │ 12.5KG │ IN       │ +50  │ 45    │ Main     │
│ ...  │ ...    │ ...      │ ...  │ ...   │ ...      │
└──────┴────────┴──────────┴──────┴───────┴──────────┘
```

**Scope toggle:** Tab/filter at top: "All Locations" | "Main Warehouse" | "Secondary" — changing this re-queries the ledger with the location filter.

---

## Alternatives Considered

| Our Choice | Alternative | Why Not |
|------------|-------------|---------|
| `locationId` nullable on `StockLedgerEntry` | Separate `WarehouseStockLedgerEntry` table | Splitting the ledger breaks the unified stock view. Nullable column is the same pattern used by `customerId`/`vendorId` on `StockLedgerEntry` already. |
| Balance per `(item, state, location)` | Balance per `(item, state)` globally + location filter on query | An index over 4 columns is cheap; recomputing from all entries every query doesn't scale as the ledger grows. |
| `pricePerKg` on `ItemPrice` | Separate `ItemKgPrice` table | Over-normalization. One more column on the existing price table is simpler and supports customer-specific KG pricing for free. |
| Derive price at transaction time | Store both rate types and let user pick | Derivation is deterministic: `pricePerKg × weight`. Only the final per-cylinder price goes into accounting. The KG rate is a reference annotation. |
| `CylinderTransfer` + `CylinderTransferLine` models | Just two stock ledger entries with a shared `sourceId` | The explicit transfer document is needed for business workflow (approval, status, line-item grouping). Two loose ledger entries lose the grouping semantic. |

---

## What NOT to Do

| Avoid | Why | Do Instead |
|-------|-----|------------|
| Add `locationId` as required NOT NULL | All existing `StockLedgerEntry` records have no location — migration would need backfill | Make it nullable; add a migration step that creates a default "Main" warehouse and backfills existing entries, but only after user confirmation |
| Use a separate "stock on hand" table (like `StockQuant`) and update it on every movement | The existing pattern uses computed balance on every entry. A separate table adds sync complexity and drift risk | Keep the append-only ledger as source of truth. Add a materialized view for dashboard if query performance becomes a concern |
| Add `pricePerKg` to `Item` instead of `ItemPrice` | KG rates vary by customer and over time. A flat rate on Item doesn't support customer-specific pricing | Put `pricePerKg` on `ItemPrice` — customer-specific, date-effective KG pricing |
| Store the derived price in `ItemPrice.price` | Destruction of information — you lose the KG rate reference | Keep `price` (fixed) and `pricePerKg` (variable) separate. `price` still holds the fixed per-cylinder rate; derived price is computed at transaction time |
| Use `UPDATE` on `StockLedgerEntry` for corrections | Violates the append-only invariant that the entire ERP depends on | Create compensating entries (negative IN, positive OUT) with sourceType `ADJUSTMENT` |
| Add warehouse-aware stock check to ALL existing flows in one migration | Too risky — breaks existing sale/purchase flows that worked without location | Add `locationId` as optional; only enforce location in new flows. Existing flows work identically (no location filter = sees all stock) |
| Use Prisma raw queries for cross-warehouse aggregation | Prisma `groupBy` + `_sum` handles the patterns we need. Raw queries bypass the ORM's type safety and tenant scoping | Use Prisma's `groupBy` with `locationId` in the `by` array for cross-warehouse reports |

---

## Phase-Specific Risk Mitigation

| Phase | Risk | Mitigation |
|-------|------|------------|
| WH-01 (add `locationId` to schema) | Existing queries break if they don't filter by location | Make `locationId` nullable; add the column but don't require it in existing service calls |
| WH-02 (warehouse-aware stock ledger service) | `balanceAfter` computed globally may differ from per-location balance | The existing stock-ledger service IS the balance computation. Changing its `findFirst` where clause to include `locationId` changes behavior. Phase WH-02 must split this: create a NEW function (`createStockLedgerEntryAtLocation`) that takes `locationId`; keep the old function unchanged for existing callers. Migrate callers one by one. |
| WH-03 (warehouse transfers) | Double-counting if transfer creates duplicate entries | The two entries (OUT from source, IN to destination) MUST happen in the same `$transaction`. Use the transfer document as `sourceId` for both. |
| PR-01 (KG pricing schema) | `cylinderWeightKg` on Item changes after transactions | Store the derived unit price and KG reference in the voucher/voucher metadata at transaction time. Never recompute from current item weight. |

---

## Sources

- **Existing codebase analysis** (`prisma/schema.prisma`, `stock-ledger.ts`, `bulk-stock-ledger.ts`, `sale-lpg.ts`, `stock-availability.ts`) — confirmed patterns and constraints
- **Prisma documentation on multi-tenant RLS** — https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security (confidence: HIGH)
- **PostgreSQL multi-warehouse inventory patterns** — Stack Overflow / WMS community (confidence: HIGH)
- **Voxire multi-warehouse sync architecture** — https://voxire.com/blog/multi-warehouse-inventory-sync-mena/ (confidence: MEDIUM — commercial blog but sound patterns)
- **prisma-accumulator** (pg_accumulator Prisma adapter) — https://pgxn.org/dist/pg_accumulator/1.1.3/ (confidence: MEDIUM — interesting extension pattern but not needed yet; would require PostgreSQL extension installation)

---

*Stack research for: LPG ERP warehouse + KG pricing extension*
*Researched: 2026-06-25*
