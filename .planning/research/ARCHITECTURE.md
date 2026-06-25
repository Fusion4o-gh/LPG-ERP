# Architecture Research: Warehouse Management & KG Pricing

**Domain:** LPG cylinder distribution ERP extension
**Researched:** 2026-06-25
**Confidence:** HIGH

## System Overview — Extended Architecture

The existing layered monolith (Next.js 15 App Router + Prisma/PostgreSQL) extends cleanly for warehouse management and KG pricing. Two additive features — stock location scoping and price-per-kg calculation — layer onto existing models without breaking the append-only stock ledger invariant or double-entry accounting.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        Client (React 19)                              │
├──────────────────────┬────────────────────────┬───────────────────────┤
│  Existing Forms      │  Warehouse Forms       │  KG Pricing Forms     │
│  (SaleLpgForm,       │  (WarehouseTransfer,   │  (ItemPriceEditor     │
│   PurchaseFilled...)  │   InventoryCount,      │   extends pricePerKg)│
│                      │   Receipt/Dispatch)     │                       │
└──────────┬───────────┴───────────┬────────────┴───────────┬───────────┘
           │ RSC / fetch JSON      │                        │
           ▼                       ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API Route Handlers (thin controllers)             │
│                                                                        │
│  Existing: sales/lpg, purchases/filled-cylinder, returns/...          │
│                                                                        │
│  New:                                                                │
│    api/warehouses/stock          — location-scoped stock ledger       │
│    api/warehouses/transfers      — warehouse transfer CRUD            │
│    api/warehouses/receipts       — warehouse receipt/dispatch         │
│    api/warehouses/inventory      — physical inventory counts          │
│    api/prices/kg                 — KG pricing CRUD                    │
│                                                                        │
│  Modified:                                                             │
│    api/stock-ledger              — add locationId query param          │
│    api/sales/lpg                 — add locationId, KG pricing calc     │
│    api/purchases/filled-cylinder — add locationId, KG pricing calc     │
│    api/purchases/other           — add KG pricing calc                 │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Domain Service Layer (business logic)             │
│                                                                        │
│  src/server/services/warehouse/                                        │
│  ├── stock-ledger.ts           — location-scoped createStockLedger    │
│  ├── stock-availability.ts     — location-scoped availability check   │
│  ├── transfers.ts              — warehouse transfer orchestration     │
│  ├── receipt-dispatch.ts       — warehouse receipt/dispatch           │
│  └── physical-inventory.ts     — inventory count + reconciliation     │
│                                                                        │
│  src/server/services/pricing/                                          │
│  ├── kg-pricing.ts             — pricePerKg calc, auto-price lines    │
│  └── item-price.ts             — extended ItemPrice CRUD              │
│                                                                        │
│  Modified existing:                                                    │
│    sales/sale-lpg.ts           — location param, KG price calc        │
│    purchases/purchase-filled-cylinder.ts — same                        │
│    inventory/stock-ledger.ts   — locationId param, scoped balanceAfter │
│    inventory/stock-availability.ts — location-scoped queries          │
│    master-data/master-data.ts  — pricePerKg in ItemPrice CRUD         │
└───────────────────────────────────┬───────────────────────────────────┘
                                    │ prisma client
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  PostgreSQL via Prisma ORM                             │
│                                                                        │
│  Modified models:                                                      │
│    StockLedgerEntry    + locationId (optional, nullable)               │
│    StockSourceType     + WAREHOUSE_TRANSFER, WAREHOUSE_RECEIPT,       │
│                          WAREHOUSE_DISPATCH, PHYSICAL_INVENTORY       │
│    ItemPrice           + pricePerKg (Decimal, nullable)               │
│                                                                        │
│  Existing unchanged:                                                   │
│    StockLocation (type: WAREHOUSE#scoped), BulkStockLedgerEntry       │
│    AccountingVoucher, ChartAccount, Customer, Vendor, Item, ...       │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### What Talks to What

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `WarehouseTransferForm` (UI) | Captures source/dest warehouse, items, quantities | `api/warehouses/transfers` |
| `WarehouseStockLedgerPage` (UI) | Displays location-scoped stock ledger | `api/warehouses/stock` |
| `WarehouseReceiptForm` (UI) | Records cylinder receipt at warehouse | `api/warehouses/receipts` |
| `PhysicalInventoryForm` (UI) | Records physical count per location | `api/warehouses/inventory` |
| `ItemPriceEditor` (UI) | Adds `pricePerKg` field alongside `price` | `api/prices` (existing) |
| `SaleLpgForm` (modified UI) | Adds location selector, KG price auto-calc | `api/sales/lpg` |
| `PurchaseFilledCylinderForm` (modified UI) | Adds location selector, KG price auto-calc | `api/purchases/filled-cylinder` |
| `warehouse/transfers.ts` (service) | Orchestrates OUT from source, IN to dest, zero accounting | `stock-ledger.ts`, `document-numbers.ts`, `audit-log.ts` |
| `warehouse/stock-ledger.ts` (service) | Location-scoped createStockLedgerEntry with locationId | Prisma `stockLedgerEntry` |
| `warehouse/stock-availability.ts` (service) | Location-scoped assertFilledStockAvailable | Prisma `stockLedgerEntry` groupBy |
| `pricing/kg-pricing.ts` (service) | Calculates total = quantity × pricePerKg × cylinderWeightKg | Prisma `item`, `itemPrice` |
| Existing `sale-lpg.ts` (modified) | Accepts optional `locationId`, calls location-scoped stock check | `warehouse/stock-availability`, `pricing/kg-pricing` |
| Existing `stock-ledger.ts` (modified) | Accepts optional `locationId`, scopes balanceAfter per location | Prisma `stockLedgerEntry` |

### Boundary Rules

1. **Warehouse services never create accounting vouchers.** Warehouse transfers are stock-only movements with no financial impact. Receipts/dispatch are also stock-only (cost basis belongs to the purchase domain).
2. **Pricing services are pure calculation.** `kg-pricing.ts` reads Item + ItemPrice, returns computed values. It never writes to the database — consumption happens in the sales/purchase services.
3. **Location scope is additive.** Existing services default to `locationId = null` (legacy behavior: all stock at implicit single plant). New calls pass `locationId` explicitly.
4. **StockLedgerEntry.balanceAfter is per (companyId, itemId, cylinderState, locationId).** The running balance scopes by locationId when present; entries with `locationId = null` maintain the legacy global balance.

## Data Flow

### 1. Warehouse Transfer

```
User submits WarehouseTransferForm
  → POST /api/warehouses/transfers
    → authenticate, validate input
    → warehouseTransferService(tx, {
        sourceLocationId,
        destLocationId,
        lines: [{itemId, filledQty, emptyQty}],
        transactionDate,
        remarks
      })
      → assertWritableBusinessDate
      → For each line:
          1. assertFilledStockAvailable at sourceLocationId (filled only)
          2. createStockLedgerEntry(tx, {
               locationId: sourceLocationId,
               direction: OUT,
               sourceType: WAREHOUSE_TRANSFER,
               sourceId: transferNo,
               ...
             })
          3. createStockLedgerEntry(tx, {
               locationId: destLocationId,
               direction: IN,
               sourceType: WAREHOUSE_TRANSFER,
               sourceId: transferNo,
               ...
             })
          4. Same for empty cylinders if transferring empties
      → create document number
      → write audit log
      → return { transferNo, stockEntries }
    → NO accounting voucher (warehouse transfers are not financial events)
```

### 2. Warehouse Receipt

```
User submits WarehouseReceiptForm
  → POST /api/warehouses/receipts
    → warehouseReceiptService(tx, {
        locationId,
        lines: [{itemId, filledQty, emptyQty}],
        referenceDocument: purchaseInvoiceNo,
        ...
      })
      → createStockLedgerEntry(tx, {
           locationId,
           direction: IN,
           sourceType: WAREHOUSE_RECEIPT,
           ...
         })
    → NO accounting voucher (purchase voucher already posted)
```

### 3. KG Pricing in Sale

```
User selects item + enters quantity in SaleLpgForm
  → Client calls GET /api/sales/lpg/context?itemId=X&quantity=Y
    → backend fetches:
        1. Item.cylinderWeightKg
        2. ItemPrice.pricePerKg for this customer (or default)
      → calculates: total = quantity × pricePerKg × cylinderWeightKg
    → returns { calculatedUnitPrice, totalAmount }
  → User sees auto-calculated price, can override
  → On submit, sale-lpg service uses the (potentially overridden) unitPrice
```

### 4. Location-Scoped Stock Availability Check

```
saleLpgSingle(input)  // input now includes optional locationId
  → assertFilledStockAvailable(tx, {
      companyId,
      financialYearId,
      locationId,  // new
      lines: [...]
    })
    → stockLedgerEntry.groupBy({
        where: {
          companyId, financialYearId,
          locationId,  // new filter
          itemId: { in: [...] },
          cylinderState: FILLED
        },
        by: ["itemId", "direction"],
        _sum: { quantity: true }
      })
    → compute net per itemId
    → assert net >= requested quantity
```

### 5. Existing Sales/Purchases (No Location) — Legacy Path

```
When locationId is not provided:
  → StockLedgerEntry queries omit locationId filter
  → balanceAfter computed across ALL entries (global stock)
  → Same as current behavior — full backward compatibility
```

## State Management

- **No global client store.** Same pattern as existing app — server is source of truth.
- Client components fetch with `cache: "no-store"` after every relevant mutation.
- `WarehouseTransferForm` holds local React state for line items, location selectors.
- `ItemPriceEditor` extends existing master-data patterns with a `pricePerKg` decimal field.

## Suggested Build Order

The build order is determined by dependency chains:

### Phase 1: Schema & Core Services (Foundation)

**Dependencies: None — everything else depends on this.**

1. Prisma migration: Add `locationId` to `StockLedgerEntry` (nullable), add new `StockSourceType` values, add `pricePerKg` to `ItemPrice`
2. Modify `createStockLedgerEntry` to accept optional `locationId` and scope `balanceAfter` per (companyId, itemId, cylinderState, locationId)
3. Create `warehouse/stock-availability.ts` with location-scoped `assertFilledStockAvailable`
4. Add `pricePerKg` to `ItemPrice` CRUD in master-data service

**Why first:** Both warehouse features and KG pricing depend on these schema and foundational changes. No other component can work without the location-scoped ledger.

### Phase 2: Warehouse Transfer

**Dependencies: Phase 1 (location-scoped stock ledger)**

5. Create `warehouse/transfers.ts` service — orchestrates paired OUT/IN entries
6. Add `WAREHOUSE_TRANSFER` to StockSourceType enum
7. Create `api/warehouses/transfers` route handler
8. Build `WarehouseTransferForm` UI component
9. Add navigation tab for warehouse transfers

**Why second:** Warehouse transfer is the simplest end-to-end warehouse feature — it validates the location-scoped ledger works correctly without touching accounting.

### Phase 3: Warehouse Receipt & Dispatch

**Dependencies: Phase 1 (location-scoped stock ledger)**

10. Create `warehouse/receipt-dispatch.ts` service
11. Add `WAREHOUSE_RECEIPT` / `WAREHOUSE_DISPATCH` to StockSourceType
12. Create API routes and UI forms

**Why third:** Reuses the same location-scoped patterns from Phase 2 but adds the document reference workflow.

### Phase 4: Physical Inventory

**Dependencies: Phase 1 (location-scoped stock ledger)**

13. Create `warehouse/physical-inventory.ts` service
14. Add `PHYSICAL_INVENTORY` source type
15. Build reconciliation logic: record count → compare with ledger → create adjustment entries
16. API routes and UI

**Why fourth:** Physical inventory is operationally important but technically straightforward — it's a specialized stock adjustment with reconciliation logic.

### Phase 5: KG Pricing Integration

**Dependencies: Phase 1 (pricePerKg on schema)**

17. Create `pricing/kg-pricing.ts` with calculation logic
18. Modify `sale-lpg.ts` to: accept optional `locationId`, call KG pricing calculator, accept override
19. Modify `purchase-filled-cylinder.ts` similarly
20. Update `SaleLpgForm` UI: add location selector, show calculated price, allow override
21. Update `PurchaseFilledCylinderForm` UI: similarly
22. Add pricePerKg field to ItemPrice master data forms

**Why last:** KG pricing touches existing transaction flows (sales, purchases) which are production-critical. It must be built on correct schema (Phase 1) and tested thoroughly. Location ID integration on transactions is grouped here because it's a parallel modifier to the same transaction code paths.

### Phase 6: Location-Aware Reports

**Dependencies: Phase 1 (schema), Phase 5 (location on transactions)**

23. Update stock report to filter/summarize by location
24. Add location dimension to existing stock reports (stock summary, customer stock ledger)
25. Build warehouse-specific stock ledger report page

**Why last:** Reports consume the data created by all other phases. Building them earlier means rebuilding when schemas change.

## Key Architectural Decisions

### Decision 1: Optional locationId on StockLedgerEntry (not a separate table)

**Decision:** Add `locationId String?` as an optional nullable field on the existing `StockLedgerEntry`.

**Why not a separate table:** The existing `StockLedgerEntry` already handles all cylinder stock movements. A separate `WarehouseStockLedgerEntry` would duplicate the entire data model and force dual-writes on every transaction (sale, purchase, return, transfer). An optional `locationId` gives us:
- Backward compatibility: existing entries have `locationId = null`, legacy queries work unchanged
- Simple migration: `ALTER TABLE "StockLedgerEntry" ADD COLUMN "locationId" TEXT REFERENCES "StockLocation"(id);`
- Single query for global vs. location-scoped stock: just add/remove the `locationId` filter

**Trade-off:** `balanceAfter` computation must scope by `locationId` when it's present. This changes the existing query pattern slightly — the "previous" entry lookup becomes:

```typescript
const previous = await tx.stockLedgerEntry.findFirst({
  where: {
    companyId: input.companyId,
    itemId: input.itemId,
    cylinderState: input.cylinderState,
    locationId: input.locationId,  // null for legacy entries
  },
  orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
  select: { balanceAfter: true },
});
```

### Decision 2: Warehouse transfers do NOT create accounting vouchers

**Decision:** Warehouse transfer service produces stock ledger entries only. No `AccountingVoucher` is created.

**Rationale:** Moving cylinders between warehouse locations is an operational movement, not a financial transaction. The cost basis of cylinders was recorded at purchase time (via the purchase voucher). No asset value changes when cylinders move between locations owned by the same entity.

**Exception:** If inter-company transfers are supported in the future (e.g., transfer between two different legal entities), that would require accounting vouchers. This is out of scope.

### Decision 3: pricePerKg on ItemPrice alongside existing price

**Decision:** Add `pricePerKg Decimal?` as an optional nullable field on `ItemPrice`. When present and the item has `cylinderWeightKg`, the system calculates `suggestedUnitPrice = pricePerKg × cylinderWeightKg`. The user can accept or override.

**Why not replace `price`:** The existing `price` field supports fixed per-cylinder pricing (e.g., "Rs. 3000 per cylinder regardless of weight"). Removing it would break existing customers. Both pricing models coexist.

### Decision 4: StockLocation reuse (not a new Warehouse model)

**Decision:** Use the existing `StockLocation` model with `type: WAREHOUSE` for warehouse locations. No new `Warehouse` model.

**Rationale:** The `StockLocation` model already exists in the bulk LPG domain with a `WAREHOUSE` type. Adding a parallel model for cylinder warehouses duplicates schema, CRUD, and selection UI. The same model serves both bulk stock locations and cylinder warehouse locations.

**Implication:** The existing `StockLocation` master data UI (already in `configuration/stock-locations`) works for creating cylinder warehouses. No new configuration pages needed unless distinction between bulk vs. cylinder locations is required.

## Data Model Changes

### StockLedgerEntry (Modified)

```
model StockLedgerEntry {
  // ... existing fields ...
  locationId  String?   // NEW: nullable, references StockLocation
  // ... existing relations ...

  location    StockLocation? @relation(fields: [locationId], references: [id])  // NEW

  @@index([companyId, itemId, cylinderState, locationId, transactionDate])  // MODIFIED index
}
```

### StockSourceType Enum (Extended)

```
enum StockSourceType {
  OPENING_BALANCE
  PURCHASE_FILLED
  SALE_LPG
  CYLINDER_RETURN
  PURCHASE_RETURN
  ADJUSTMENT
  WAREHOUSE_TRANSFER      // NEW
  WAREHOUSE_RECEIPT       // NEW
  WAREHOUSE_DISPATCH      // NEW
  PHYSICAL_INVENTORY      // NEW
}
```

### ItemPrice (Modified)

```
model ItemPrice {
  // ... existing fields ...
  pricePerKg  Decimal?  @db.Decimal(14, 2)  // NEW: nullable, per-kg rate
  // ... existing relations ...
}
```

## New API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/warehouses/stock?locationId=X&itemId=Y` | Location-scoped stock balance |
| POST | `/api/warehouses/transfers` | Create warehouse transfer |
| GET | `/api/warehouses/transfers?from=...&to=...` | List transfers |
| POST | `/api/warehouses/receipts` | Record warehouse receipt |
| POST | `/api/warehouses/dispatch` | Record warehouse dispatch |
| POST | `/api/warehouses/inventory` | Record physical inventory count |
| GET | `/api/warehouses/inventory?locationId=X` | List inventory counts |
| POST | `/api/warehouses/inventory/:id/reconcile` | Reconcile count → adjustments |
| GET | `/api/prices/kg?itemId=X&customerId=Y` | Calculate KG-based price |

## Modified API Routes

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/stock-ledger` | Add `locationId` query param filter |
| POST | `/api/sales/lpg` | Add `locationId` field, KG price auto-calc |
| POST | `/api/sales/lpg/batch` | Add `locationId` field per sale |
| POST | `/api/purchases/filled-cylinder` | Add `locationId` field, KG price auto-calc |
| GET | `/api/sales/lpg/context` | Add KG price calculation in response |

## New UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `WarehouseTransferForm` | `src/components/warehouse/WarehouseTransferForm.tsx` | Multi-line warehouse transfer form |
| `WarehouseStockLedgerClient` | `src/components/warehouse/WarehouseStockLedgerClient.tsx` | Location-filtered stock ledger view |
| `WarehouseReceiptForm` | `src/components/warehouse/WarehouseReceiptForm.tsx` | Receipt recording form |
| `WarehouseDispatchForm` | `src/components/warehouse/WarehouseDispatchForm.tsx` | Dispatch recording form |
| `PhysicalInventoryForm` | `src/components/warehouse/PhysicalInventoryForm.tsx` | Count + reconcile form |
| `KgPriceCalculator` | `src/components/pricing/KgPriceCalculator.tsx` | Inline KG price display/override in sale/purchase forms |

## Modified UI Components

| Component | Change |
|-----------|--------|
| `SaleLpgForm` | Add location dropdown; show KG-calculated price with override |
| `PurchaseFilledCylinderForm` | Add location dropdown; show KG-calculated price with override |
| `StockLedgerPageClient` | Add location filter dropdown |
| `ItemPrice` editor (master data) | Add `pricePerKg` field alongside `price` |
| Navigation `modules.ts` | Add warehouse operation tabs to Configuration or new Warehouse module |

## Navigation Changes

A new module or a section under Configuration:

```typescript
// In src/lib/navigation/modules.ts
const warehouseTabs: NavTab[] = [
  { label: "Warehouse Transfer", href: "/warehouse/transfer", module: "warehouse" },
  { label: "Warehouse Receipt", href: "/warehouse/receipt", module: "warehouse" },
  { label: "Warehouse Dispatch", href: "/warehouse/dispatch", module: "warehouse" },
  { label: "Physical Inventory", href: "/warehouse/inventory", module: "warehouse" },
  { label: "Warehouse Stock Ledger", href: "/warehouse/stock-ledger", module: "warehouse" },
];
```

Alternatively, add these as operations under the existing "Sale / Purchase" module or a new tab group under Configuration, depending on user workflow preference.

## Physical Inventory Page Structure

```text
src/app/(protected)/warehouse/
├── transfer/
│   └── page.tsx              ← WarehouseTransferForm
├── receipt/
│   └── page.tsx              ← WarehouseReceiptForm
├── dispatch/
│   └── page.tsx              ← WarehouseDispatchForm
├── inventory/
│   └── page.tsx              ← PhysicalInventoryForm + list
└── stock-ledger/
    └── page.tsx              ← WarehouseStockLedgerClient
```

## KG Pricing Page Structure

```text
// No new pages — KG pricing integrates into existing forms:
src/components/
├── pricing/
│   └── KgPriceCalculator.tsx  ← Inline component embedded in SaleLpgForm
│                                and PurchaseFilledCylinderForm
```

## Anti-Patterns to Avoid

### 1. Warehouse Transfer Creating Accounting Vouchers

**What people do:** Record a journal entry when stock moves between warehouses (debit warehouse A stock, credit warehouse B stock).

**Why it's wrong:** Warehouse transfers are operational movements within the same legal entity. Creating vouchers doubles the financial entries (purchase already recorded the cost) and distorts P&L.

**Instead:** Stock-only entries. Only create accounting entries if the transfer changes ownership (inter-company), which is explicitly out of scope.

### 2. Separate WarehouseStockLedger Table

**What people do:** Create a new `WarehouseStockLedgerEntry` table for warehouse stock movements, separate from `StockLedgerEntry`.

**Why it's wrong:** Every sale and purchase would need dual writes to both tables. Stock queries become JOINs or UNIONs. The query complexity compounds with every new transaction type.

**Instead:** Add `locationId` as an optional field on the existing `StockLedgerEntry`. NULL = legacy global stock.

### 3. Making locationId Required

**What people do:** Make `locationId` a required field on `StockLedgerEntry` and force migration of all historical data.

**Why it's wrong:** Millions of existing entries would need backfills. Every existing API call would break until updated. The migration would be a months-long ordeal.

**Instead:** Optional field. Legacy entries are NULL. New transactions progressively adopt location scoping as features are built.

### 4. KG Price Overwriting Existing Prices

**What people do:** Replace the `price` field on `ItemPrice` with `pricePerKg` and force all customers to use KG pricing.

**Why it's wrong:** Customers who use fixed per-cylinder pricing lose their existing price data. The system becomes unusable for non-KG items (accessories, service charges).

**Instead:** `pricePerKg` is an additional optional field. The system presents the calculated price as a suggestion; users can accept or override. Both pricing models coexist.

## Scalability Considerations

| Concern | Current (single location) | With warehouses |
|---------|--------------------------|-----------------|
| Stock ledger query | Single pass per item | Indexed by (companyId, itemId, cylinderState, locationId) — still single-pass per scope |
| Balance computation | `findFirst` by item+state | Same pattern, just adds `locationId` filter |
| Stock availability check | GroupBy across all entries | Same groupBy with locationId filter — identical complexity |
| Warehouse transfers | N/A | 2 writes per line (OUT + IN) — negligible overhead |
| Concurrent transfers | N/A | Prisma transaction isolation handles consistency |

**No performance concerns at current scale.** The existing patterns (single index scan per query) extend linearly with the location dimension. At extreme scale (>100 warehouses, >10M entries), the index on `(companyId, itemId, cylinderState, locationId, transactionDate)` handles all common queries with point lookups.

## Sources

- Codebase analysis of existing patterns (ARCHITECTURE.md, stock-ledger.ts, stock-availability.ts, sale-lpg.ts, purchase-filled-cylinder.ts)
- Prisma schema analysis (schema.prisma — StockLocation, BulkStockLedgerEntry, StockLedgerEntry models)
- Existing project decisions (PROJECT.md — Key Decisions section)

---

*Architecture research for: Warehouse Management & KG Pricing integration*
*Researched: 2026-06-25*
