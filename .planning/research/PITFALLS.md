# Pitfalls: LPG Cylinder Warehouse Management & KG-Based Pricing

**Domain:** LPG cylinder distribution ERP — multi-warehouse cylinder stock tracking and KG-based pricing
**Researched:** 2026-06-25
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Cylinder Stock Without Location Awareness (Stock Appears in Two Places)

**What goes wrong:**
The existing `StockLedgerEntry` has no `locationId` — cylinder stock is tracked per `(companyId, itemId, cylinderState)` only. When adding `locationId` to the ledger, all historical entries lack a location. Existing reports, balance calculations, and the `balanceAfter` chain implicitly assume global stock. After migration, the same cylinder quantity can appear counted in two warehouses simultaneously because old entries (with `locationId = null`) get conflated with new location-scoped entries. The result: stock is double-counted in reports and the system shows 200 filled cylinders at Warehouse A AND 200 at Warehouse B when there are only 200 total.

**Why it happens:**
- The codebase has zero patterns for location-scoped cylinder stock — only the bulk LPG module (`BulkStockLedgerEntry`) already uses `locationId`. The cylinder stock ledger is entirely location-unaware.
- `createStockLedgerEntry` computes `balanceAfter` as a running sum over `(companyId, itemId, cylinderState)` with no location dimension. Adding `locationId` to the WHERE clause breaks the balance chain for old entries.
- Engineers naturally add `locationId` to the `StockLedgerEntry` model and mark it `optional` (nullable) for backward compatibility, creating a split ledger where some rows are location-scoped and some are not.

**How to avoid:**
- **Do NOT make `locationId` nullable on StockLedgerEntry.** Require a location for every new entry. Run a one-time backfill migration that assigns all historical entries to a default "Main Plant" location (create a `StockLocation` record per company if none exists).
- Follow the `BulkStockLedgerEntry` pattern: the location must be part of the balance chain key. The `balanceAfter` calculation must filter by `(companyId, itemId, cylinderState, locationId)`.
- Add a `@@unique` or `@@index` on `(companyId, itemId, cylinderState, locationId, transactionDate)` to make the location dimension unambiguous.
- Before going live, run a reconciliation query: sum physical counts per location vs. `balanceAfter` per location. Any mismatch means the migration or balance chain is wrong.

**Warning signs:**
- Stock reports show identical counts across warehouses for the same item
- The sum of per-warehouse stock exceeds the total known physical stock
- Users report "we sold from Warehouse A but the stock didn't decrease there"
- Balance chain queries return different totals depending on whether `locationId` is included in the WHERE clause

**Phase to address:**
- Phase WH-01 / WH-02 (multi-location cylinder tracking). The `locationId` column addition AND the migration script must be co-designed. The balance chain fix is not optional — without it, the warehouse feature produces wrong data immediately.

---

### Pitfall 2: Transfer Accounting Errors (Double-Counting During Warehouse Transfers)

**What goes wrong:**
A warehouse transfer requires two stock ledger entries: an OUT from source warehouse and an IN to destination warehouse. If these are not wrapped in a single atomic transaction, a crash between the two entries causes:
- **Loss scenario:** OUT written, IN not written → cylinders vanish from the system (stock shows a permanent decrease)
- **Gain scenario:** IN written, OUT not written → cylinders appear twice (double-counted across both warehouses)
- **Duplicate scenario:** The transfer form is submitted twice (user double-click, network retry) and both sides fire again, creating two OUTs and two INs.

**Why it happens:**
- The existing transaction patterns in the codebase (`sale-lpg.ts`, `purchase-filled-cylinder.ts`) create a single stock entry + a single voucher — there is no existing pattern for a paired-atomic multi-entry operation like a transfer.
- The `createStockLedgerEntry` function is designed for single-movement transactions. There is no `TransferService` or `createTransferEntries` function that enforces the paired nature.
- Network retries and form resubmissions are not idempotent — re-submitting the transfer creates duplicate entries.

**How to avoid:**
- Always wrap OUT + IN in a single Prisma transaction using the existing `Tx` pattern. If either fails, both roll back.
- Add an idempotency key on transfer submissions. Generate a unique `transferRequestKey` on the client when the form loads, and upsert on that key server-side.
- Create a dedicated `transferCylinders` service function that:
  1. Validates stock availability at source (balance check)
  2. Creates OUT entry (direction=OUT, sourceLocation)
  3. Creates IN entry (direction=IN, destinationLocation)
  4. Optionally creates a journal entry for accounting (if there's a value difference)
  5. Returns both stock entries as a single response
- Consider adding a `transferId` grouping field to `StockLedgerEntry` so transfer pairs are always traceable. This also enables a periodic reconciliation job to detect orphaned transfer legs.

**Warning signs:**
- Sum of stock across all locations changes after a transfer
- A transfer completes but only half the cylinders arrive
- Stock ledger shows an unpaired negative entry (OUT with no matching IN)
- Users report "we sent 50 cylinders but only 30 arrived"

**Phase to address:**
- Phase WH-03 (warehouse transfers). This phase MUST design the transfer as an atomic paired operation from day one. It cannot be an afterthought.

---

### Pitfall 3: KG Pricing Calculation Mistakes (Unit Mismatches, Rounding, Null Weights)

**What goes wrong:**
The KG pricing formula is `total = pricePerKg × cylinderWeightKg`. Three distinct failure modes:
1. **Null cylinderWeightKg:** The `cylinderWeightKg` field on `Item` is nullable (`Decimal?`). If a user creates a price with `pricePerKg` but the item has no `cylinderWeightKg`, the system either crashes, silently returns 0, or generates an incorrect total by treating null as 0.
2. **Unit mismatch:** `pricePerKg` is in the user's currency per kilogram. But the `cylinderWeightKg` stores the total gas weight of a filled cylinder (e.g., 12.5 kg). If a user enters `pricePerKg` expecting it to be per "KG of LPG" but the system multiplies by cylinderWeightKg, and the cylinderWeightKg stores the weight of the cylinder itself plus gas, the math is wrong. Or worse, the user enters a per-cylinder price into the `pricePerKg` field, doubling the price.
3. **Decimal rounding:** The `price` field on `ItemPrice` is `Decimal(14,2)` — 2 decimal places. If `pricePerKg = 185.50` and `cylinderWeightKg = 12.5`, the total is `2318.75`. But if `cylinderWeightKg = 12.55` and `pricePerKg = 185.75`, the total is `2331.1625` which rounds to `2331.16` — a 0.0025 loss per cylinder. At 10,000 cylinders, that's a 25 currency-unit accounting discrepancy that doesn't tie out.

**Why it happens:**
- `cylinderWeightKg` was always nullable (some items aren't cylinders — e.g., regulators, hoses). No validation guard exists to require it for KG-priced items.
- The existing `price` field and the new `pricePerKg` field coexist on `ItemPrice`. Engineers may confuse the two, or create forms where both can be set simultaneously without a clear precedence rule.
- Decimal(14,2) truncation is the existing schema constraint. Changing it to Decimal(14,4) would require a migration and affect all existing price data.

**How to avoid:**
- **Make KG pricing mutually exclusive with fixed pricing at the schema/validation level.** Either an ItemPrice has `price` (fixed per cylinder) OR `pricePerKg` (calculated per cylinder), not both. Add a CHECK constraint or application-level validation.
- **Require `cylinderWeightKg` to be non-null when any `ItemPrice` for that item uses `pricePerKg`.** Add a validation rule: if any price record for an item has `pricePerKg`, that item's `cylinderWeightKg` must be set. Reject save if violated.
- **Use `Decimal(14, 4)` or `Decimal(16, 4)` for the computed total** to avoid cumulative rounding errors. Alternatively, store `pricePerKg` and `cylinderWeightKg` as the source of truth and compute the total at display time with full precision — never store the pre-computed total.
- **Add explicit unit labels in the UI.** The KG pricing field should be labeled "Price per KG (PKR/kg)" and the weight display "Cylinder weight (kg)" to prevent unit confusion.
- **Write a reconciliation query** that detects rounding drift: `SUM(ROUND(pricePerKg * cylinderWeightKg, 2)) - SUM(pricePerKg * cylinderWeightKg)` should be near zero. Schedule it as a periodic check.

**Warning signs:**
- A KG-priced sale total doesn't match `pricePerKg × cylinderWeightKg` when calculated manually
- Two transactions with the same `pricePerKg` and same item produce different totals
- Items that are clearly not cylinders (hoses, regulators) have KG prices set
- KG price set but the item has no cylinder weight configured
- Financial reports show small unexplained differences between sales and stock value

**Phase to address:**
- Phase PR-01 / PR-02 / PR-03 (KG-based pricing). The validation of `cylinderWeightKg` nullability and the Decimal precision decision must be made before any KG pricing code is written. Retro-fitting it is much harder.

---

### Pitfall 4: Append-Only Stock Ledger Invariant Broken During Warehouse Operations

**What goes wrong:**
The append-only stock ledger invariant is the system's most critical data integrity rule: every stock movement produces an immutable entry with a running `balanceAfter`. Warehouse operations (transfers, physical counts, adjustments) introduce new movement types that can tempt engineers to:
- **Update existing entries** (e.g., when a transfer is rejected, "fix" the original entry rather than creating a reversal)
- **Delete entries** (e.g., a user entered wrong quantities in a receipt and wants to "undo" it)
- **Directly set `balanceAfter`** (e.g., for physical count adjustments, set balanceAfter = physical count, breaking the running sum)

Once the append-only invariant is broken, the stock balance chain is irreparably corrupted — you cannot trust any stock report because you don't know which entries were mutated.

**Why it happens:**
- Physical inventory counts naturally make you want to "snap" the balance to the physical count. Engineers see `balanceAfter = physicalCount` as the simplest implementation.
- Reversal patterns require more code (create a new entry that negates the old one). Engineers take the shortcut of mutating the original.
- The existing `createStockLedgerEntry` function throws on negative quantities and has no "adjustment" mode. When adding warehouse features, engineers may modify it to allow negative stock or updates instead of creating proper reversal entries.

**How to avoid:**
- **Design warehouse adjustments (physical counts) as zero-balance entries:** When a physical count reveals a discrepancy, create TWO entries atomically: (1) a reversal of the original movement if it was wrong, or (2) an adjustment entry that moves stock from "unaccounted" to the correct location. Never overwrite a previous entry.
- **Add a `StockAdjustmentReason` enum** (PHYSICAL_COUNT, THEFT, DAMAGE, LOST, FOUND) and require it for all adjustment entries. This makes adjustments auditable and searchable.
- **For transfers:** Use the reversal pattern for cancellations. If a transfer needs to be cancelled, create reverse OUT and reverse IN entries rather than deleting or updating the originals.
- **Enforce read-only on all stock ledger tables at the database level** if possible (row-level security or a trigger that blocks UPDATE/DELETE). This makes the invariant a database constraint, not just application convention.
- **Never allow negative quantities in `createStockLedgerEntry`.** Use `StockDirection.OUT` for outbound movements instead. The only way to "undo" an OUT is to create an IN entry with appropriate references.

**Warning signs:**
- Any code path calls `stockLedgerEntry.update` or `stockLedgerEntry.delete` (grep for these — they should not exist in production code paths)
- Stock reports show a `balanceAfter` that doesn't equal the previous `balanceAfter` + the signed quantity of the current entry
- A "reversal" is implemented by setting quantity to 0 instead of creating an opposite entry
- Physical count adjustments directly write to `balanceAfter`

**Phase to address:**
- Phase WH-04 / WH-05 (warehouse receipt/dispatch and physical counts). The physical count feature MUST be designed as adjustment entries that preserve the append-only chain. Document the pattern explicitly in a shared utility function (`createStockAdjustmentEntry`).

---

### Pitfall 5: Permission/Access Control Issues with Multi-Warehouse Setup

**What goes wrong:**
Adding warehouses introduces a new access control dimension: which users can see/use which warehouses. Typical failures:
- A salesperson at Warehouse A creates a sale from Warehouse B's stock (they shouldn't have access)
- A warehouse manager can transfer stock from any warehouse, not just their own
- A user with "view all stock" permission sees combined stock but can't tell which warehouse has what
- Physical count permissions are too broad — any warehouse operator can adjust stock at any location
- After adding `locationId` permission checks, the system becomes confusing: "I can create a sale but not at this warehouse"

**Why it happens:**
- The existing RBAC system (`enforcePermission` in `src/server/services/rbac/enforce.ts`) checks global permissions like `stock.ledger.view` or `sales.create`. There is no concept of resource-level or scope-level permissions (e.g., `sales.create` scoped to a specific warehouse).
- The `StockLocation` model has no ownership or assigned-user concept. Any user with stock permissions can access any location.
- Engineers add `locationId` to queries and forms without considering who should be able to see/use each location.
- The existing permission check pattern is a simple "does user have permission key Y/N" — adding location-scoping requires a structural change.

**How to avoid:**
- **Add an `assignedUsers` or `allowedRoles` relation to `StockLocation`** (or at minimum a `managerId` field) so warehouses can be access-controlled.
- **Extend the `enforcePermission` pattern** to accept an optional `locationId` parameter. Create a helper: `enforceLocationPermission(userId, companyId, locationId, requiredPermission)` that checks both the global permission AND the location assignment.
- **Use the "deny by default" pattern:** a user with `stock.ledger.view` can see stock at warehouses they are assigned to. If they need cross-warehouse access, an explicit `crossWarehouse` permission key should be granted.
- **In the UI:** Filter warehouse dropdowns to only show warehouses the current user has access to. Never show all warehouses and then fail on save — that's a terrible UX.
- **Document the permission model clearly** in the codebase before implementation. The permission schema should be decided before any warehouse code is written.

**Warning signs:**
- Warehouse dropdown shows every warehouse regardless of user role
- A user can submit a transaction for a warehouse they've never interacted with
- The permission error for warehouse access is a generic 403 with no explanation
- The codebase has `locationId` in service function signatures but no permission check on it
- Existing tests pass without any location-scoping in the permission setup

**Phase to address:**
- Phase WH-01 (multi-location setup). The access control model must be designed alongside the warehouse data model, not retrofitted after the fact. Consider making it a shared component so all warehouse features use the same check.

---

### Pitfall 6: Migration/Data Integrity When Adding Location to Existing Stock Entries

**What goes wrong:**
Adding `locationId` to `StockLedgerEntry` requires a schema migration. Without careful handling:
- **The `balanceAfter` chain breaks:** Old entries have `locationId=null`. New entries filter by `locationId`. Running a stock query across old+new entries returns wrong balances because the old entries don't participate in per-location filtering.
- **Dual-balance problem:** The system now has two truth sources — the `balanceAfter` chain per location (for new entries) and the legacy `balanceAfter` chain without location (including old + new entries).
- **Rollback is impossible:** If the migration goes wrong, rolling back the schema loses all new location-scoped data. The migration must be testable and reversible.
- **Foreign key issues:** If `locationId` references `StockLocation`, old entries need a valid location to reference. Creating a synthetic "legacy" location per company is fragile — what if a real location already has that code?

**Why it happens:**
- Prisma migrations are additive by nature — adding a nullable column is the path of least resistance. Engineers take it because it avoids a backfill.
- The `balanceAfter` invariant is computed in application code (`createStockLedgerEntry`), not in the database. The migration only changes the schema, not the balance computation logic.
- Testing with production-scale data is difficult. The migration works on test data (small, clean) but fails on production (millions of entries with edge cases).

**How to avoid:**
- **Design the migration as a multi-step rollout:**
  1. Schema-only: Add `locationId` as optional (nullable) AND create a default "Main Location" per company
  2. Backfill: Run a batch job that assigns every historical StockLedgerEntry to its company's default location
  3. Validation: Run reconciliation queries to verify the balance chain is intact per location
  4. Lock: Make `locationId` required (NOT NULL) after backfill is verified
- **Build a migration validation script** that runs BEFORE and AFTER:
  - For each company/item/cylinderState, does the sum of all balanceAfters per location equal the old global balanceAfter?
  - Are there any StockLedgerEntry rows with `locationId=null` after step 2?
  - Test on a production database snapshot, not just test data
- **Do NOT dual-write** (write to both location and non-location systems). Commit fully to location-scoped entries.
- **Update ALL existing service functions** that call `createStockLedgerEntry` to pass a `locationId`. Every call site (sales, purchases, returns, etc.) must be audited and updated in the same migration.
- **Have a rollback plan:** Know exactly how to reverse the schema change if validation fails.

**Warning signs:**
- The schema migration script adds `locationId` as optional and says "we'll fix it later"
- No validation script exists for the migration
- The migration plan doesn't include updating all `createStockLedgerEntry` call sites
- Old stock reports and new warehouse reports show different totals for the same period
- The backfill creates a location named "Default" or "Legacy" without a code/name validation check

**Phase to address:**
- Phase WH-02 (warehouse location on StockLedgerEntry). This is purely a migration and data integrity phase — it must be designed separately from the feature phases. Consider it the highest-risk phase.

---

### Pitfall 7: UI/UX Mistakes in Warehouse Selection and KG Price Display

**What goes wrong:**
Users in LPG distribution shops are not trained for complex warehouse UIs. Specific failure modes:
1. **Warehouse selection hidden:** During sale entry, the warehouse field is buried in an "Advanced" section. Users forget to set it, and sales get posted to the wrong warehouse (or the default).
2. **Wrong default warehouse:** The system defaults to the user's "last used" warehouse but the user moves between locations. They don't notice the warehouse changed.
3. **KG price vs fixed price confusion:** The price display shows both `price` and `pricePerKg` without clear visual distinction. Users enter a per-cylinder price into the KG field or vice versa.
4. **KG price computed at wrong time:** The `pricePerKg × cylinderWeightKg` total is computed on the client and sent to the server. If the server re-computes it differently (different rounding), the saved total doesn't match what the user saw.
5. **Warehouse name overload:** The warehouse dropdown shows only names ("Main", "Branch A") without any identifying context (city, address, code). Users select the wrong warehouse because names are similar.
6. **No confirmation for location change:** A user changes the warehouse on an existing transaction draft. The system silently updates stock visibility without warning, and the user continues working with incorrect stock levels.

**Why it happens:**
- Engineers design forms for data completeness, not for the user's workflow. The warehouse field is treated as "just another field" rather than a context-switch.
- The existing forms (`sale-lpg.tsx`, purchase forms, etc.) are already complex with many fields. Adding warehouse and KG price without UX consideration makes them overwhelming.
- LPG distribution operators work fast — they process many customers per day. Any UI friction (extra clicks, confusing fields) leads to errors or workarounds.

**How to avoid:**
- **Make warehouse selection a top-level context, not a field.** Use a persistent warehouse selector in the header/nav (like "Current Warehouse: Main →"). All transactions default to this. Changing it is a deliberate action. This avoids per-form warehouse selection altogether.
- **Show warehouse code + name + city** in selector dropdowns, not just name: "WH-001 · Main Warehouse · Lahore"
- **For KG pricing:** Never show both `price` and `pricePerKg` on the same form. Use separate KG-pricing vs fixed-pricing modes selected by a toggle/radio. When KG mode is active, show `pricePerKg` and `cylinderWeightKg` with visible multiplication: "185.50 PKR/kg × 12.5 kg = 2,318.75 PKR"
- **Compute KG totals server-side only.** Send `pricePerKg` and `cylinderWeightKg` to the server and compute the total there. The client displays the server-computed value as read-only. This prevents rounding mismatches.
- **Add a stock visibility indicator per warehouse** (colored badge showing "Filled: 200, Empty: 50") so users can confirm they're at the right warehouse before transacting.
- **When the warehouse context changes on a draft:** Show a dialog: "Changing warehouse from Main to Branch A will update available stock. Continue?"
- **Audit-log warehouse context changes** so usage patterns can be studied and the UX iterated.

**Warning signs:**
- Warehouse selection is a dropdown at the bottom of a long form
- Users frequently select the wrong warehouse (detectable from correction/save patterns)
- KG price is displayed as a single number with no visible calculation breakdown
- Support tickets about "wrong price" that turn out to be KG vs fixed confusion
- Warehouse field added to forms without any supporting UX (no stock indicator, no confirmation)

**Phase to address:**
- Phase WH-01 / PR-01 (the first warehouse and KG pricing phases must include UX prototyping). The `design-reflex` skill should be invoked for the warehouse selector and price display components before any backend code is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Making `locationId` nullable on StockLedgerEntry | Avoids migration backfill | Perpetual split-ledger ambiguity; stock queries never trustable | **Never** — the balance chain invariant requires location to be part of the key |
| Single `transferCylinders` function without idempotency | Faster to implement | Duplicate transfers on network retry; need manual reconciliation to fix | Only behind an idempotency key guard, or during initial dev-only prototyping |
| Client-side KG total computation | Faster UX (no round-trip) | Server/client rounding mismatch; wrong amounts saved; accounting doesn't tie | **Never** — always compute on server. Client can display server-computed value. |
| Physical count adjustments that directly set `balanceAfter` | Simplest implementation | Breaks append-only invariant; impossible to audit stock history | **Never** — always use adjustment entries |
| Reusing the existing `createStockLedgerEntry` without location | No code change | Warehouse feature never actually works; all stock aggregated | During the migration window only (while locationId is being added) |
| Global warehouse dropdown (no permission filtering) | Quick to implement | Users see stock they shouldn't; wrong-warehouse transactions | **Never** for production — filtering must be built |
| Adding `pricePerKg` alongside `price` on ItemPrice without exclusive-mode | Fast schema change | Users confuse pricing modes; transactions use wrong calculation | Only during a transition period with aggressive UI validation, then migrate to exclusive |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `ItemPrice` with `pricePerKg` + existing sale/purchase services | Passing `pricePerKg` to `createSale` which expects a fixed price | Create a KG-specific overload or a `computedTotal` that replaces the fixed price before it reaches the service |
| Warehouse stock check in existing sale service | Sale service checks global stock (no location). After migration, it still checks global stock instead of source-warehouse stock | Thread the `sourceLocationId` through the sale flow; check stock at *that* warehouse before committing |
| Physical count → StockLedgerEntry | Physical count writes a single adjustment entry that "corrects" balanceAfter to the physical count | Write an adjustment entry that records the delta (actual - recorded) as a movement, preserving the append-only chain |
| Transfer cancellation → existing reversal patterns | Cancelling a transfer deletes the original entries or updates them to zero | Create reverse entries (OUT becomes IN at source, IN becomes OUT at destination) linked by `transferId` |
| KG pricing with customer-specific prices (`customerId` on ItemPrice) | `customerId` exists on ItemPrice but KG pricing applies to all customers of a given price tier | Ensure `pricePerKg` on a customer-specific ItemPrice overrides the generic rate. Use `findFirst({ where: { itemId, customerId } })` with fallback to `{ itemId, customerId: null }` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Stock report queries that JOIN StockLedgerEntry across all locations without location filter | Slow reports as warehouse count grows; report timeouts | Add location filter to ALL stock queries; create composite index on `(companyId, itemId, cylinderState, locationId, transactionDate)` | >5 warehouses or >100K stock entries |
| Per-request permission check that also checks location assignment | Transaction API latency increases; double the DB queries | Cache the user's warehouse assignment for the request lifetime (resolve once in middleware) | >50 concurrent users |
| KG total recomputation on every row in a sale (10-line sale = 10 KG multiplies) | Save latency perceived as "sluggish" | Pre-compute KG total in the service layer once and pass it through; avoid per-line recompute in loops | Any multi-line sale |
| Balance chain recalculation on every new entry for large companies | Stock entry creation slows as history grows | The existing pattern already uses `findFirst` (last entry) not `sum(all)`. Keep this pattern for the location-scoped version too. Index on the location-scoped key is critical. | >1M stock entries per location |
| Warehouse dropdown loading all warehouses for user without filtering | UI freezes; user selects wrong warehouse | Filter by user assignment; show only 5-10 most relevant warehouses; add search | >15 warehouses |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not scoping warehouse access (any user with stock permission can access any warehouse) | Warehouse A operator creates a sale from Warehouse B's stock — cross-warehouse stock corruption | Add explicit warehouse-user assignments; enforce in every service function that accepts `locationId` |
| `locationId` provided by client without server validation | Attacker submits `locationId` belonging to another company's warehouse | Always validate `locationId` belongs to the user's `companyId` before using it, similar to how `itemId` is now validated against companyId |
| KG pricing input from client without server recalculation | Attacker submits a KG price that doesn't match `pricePerKg × cylinderWeightKg`, causing accounting irregularities | Server must always recalculate the total from `pricePerKg` and `cylinderWeightKg`. Never trust the client-computed total. |
| Physical count adjustments without audit trail | A user with adjustment permission silently changes stock; no way to trace who adjusted what and why | Every physical count adjustment must log: who, when, which warehouse, old balance, new balance, reason. Stored in a separate `StockAdjustment` table. |
| Warehouse transfer without source-location stock validation | Transfer creates an OUT even though source warehouse doesn't have enough cylinders | Validate stock at source before creating the OUT entry. Fail early with a clear message. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Warehouse selector as a dropdown field on every form | Users forget to set it; transactions post to wrong warehouse | Make warehouse a persistent top-level context (header selector), not a form field |
| KG price shown as a single computed number | Users can't tell if it was calculated correctly | Show the formula: `185.50 PKR/kg × 12.5 kg = 2,318.75 PKR` with all terms visible |
| Both `price` and `pricePerKg` on the same form | Users enter into wrong field; hard to detect | Use a clear mode toggle ("Fixed per cylinder" vs "KG-based pricing") that shows only the relevant field |
| Warehouse names without location context (codes, city) | Users select wrong warehouse when names are similar | Show `[WH-001] Main Warehouse - Lahore` in all dropdowns |
| No stock indicator when warehouse is selected | Users don't know if they're at the right warehouse | Show real-time stock badge: "Filled: 200 | Empty: 50" next to the warehouse selector |
| No confirmation on warehouse change for draft transactions | Users silently continue with wrong stock context | Show dialog: "Changing warehouse will update available stock. Continue?" |
| Physical count screen shows raw numbers without last-count-date | Users don't know if the count is stale | Show "Last count: 2026-06-20 | Current system: 200 filled" for context |
| Error message: "Insufficient stock at this location" without suggesting alternatives | User doesn't know where the stock IS | Show "Insufficient stock at Main. Available: Warehouse B (40), Warehouse C (80)" |

## "Looks Done But Isn't" Checklist

- [ ] **`locationId` on StockLedgerEntry:** Migration ran but old entries were backfilled? `balanceAfter` chain still intact? All existing service call sites updated? Verify: run stock report before/after migration — totals match.
- [ ] **Warehouse transfer:** Transfer creates OUT + IN atomically? Idempotency key on form resubmission? Transfer cancellation creates reversals (not deletes)? Verify: submit transfer, cancel it — stock totals should be identical to before the transfer.
- [ ] **KG pricing:** `cylinderWeightKg` validated as non-null when `pricePerKg` is set? Total computed server-side (not client)? Rounding strategy documented and tested? Verify: create KG price for item without weight — should be rejected.
- [ ] **Physical count adjustments:** Adjustment creates ledger entries (not overwrites)? Old and new balance recorded in audit trail? Adjustment reason required? Verify: run physical count adjustment, check stock ledgers show two entries (the original + the adjustment).
- [ ] **Permission scoping:** Every service function that accepts `locationId` also validates it? Warehouse dropdowns filtered by user assignment? Verify: log in as user assigned to Warehouse A only — can you see/use Warehouse B?
- [ ] **Migration rollback:** Schema migration can be reversed? Backfill is idempotent (running twice doesn't break data)? Verification queries exist? Verify: run migration forward, run validation script, run rollback, run validation again.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double-counted cylinder stock after migration (Pitfall 1) | HIGH | 1) Freeze all warehouse ops immediately. 2) Run reconciliation query to identify all misattributed entries. 3) Write corrective adjustment entries for each location. 4) Fix the balance chain query. 5) Reprocess affected reports. |
| Duplicate transfer entries (Pitfall 2) | MEDIUM | 1) Identify orphaned pairs via `transferId` grouping. 2) For unpaired OUTs, create reversal INs. For unpaired INs, create reversal OUTs. 3) Add idempotency guard to prevent recurrence. |
| KG pricing rounding errors (Pitfall 3) | LOW | 1) Identify affected transactions via reconciliation query. 2) Create corrective accounting vouchers for the rounding differences. 3) Consider changing Decimal precision if systematic. 4) Update price calculation logic. |
| Broken append-only invariant (Pitfall 4) | VERY HIGH | 1) Identify all mutated entries via database audit logs or createdAt/updatedAt comparison. 2) For each mutated entry, write corrective reversal entries. 3) Implement database-level triggers to prevent future mutations. 4) Full audit of all stock reports since the corruption began. |
| Cross-warehouse permission breach (Pitfall 5) | MEDIUM | 1) Review audit logs for unauthorized transactions. 2) Create corrective entries for any misattributed stock. 3) Harden permission enforcement. 4) Notify affected customers if financial impact. |
| Failed migration with corrupted balance chain (Pitfall 6) | VERY HIGH | 1) Execute rollback plan. 2) Restore database from pre-migration backup. 3) Re-analyze migration strategy with production data snapshot. 4) Test migration on full data before re-attempting. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Location-unaware stock (Pitfall 1) | WH-02 (add locationId to StockLedgerEntry) | Balance chain reconciliation: per-location balanceAfter sum must equal old global balanceAfter |
| Transfer double-counting (Pitfall 2) | WH-03 (warehouse transfers) | Atomic transfer test: crash mid-transfer, stock totals must be unchanged. Idempotency test: submit same transfer twice, only one accepted. |
| KG pricing errors (Pitfall 3) | PR-01 (KG pricing on ItemPrice) | Null weight rejection test. Server-side computation test. Rounding accuracy test with known values. |
| Broken append-only invariant (Pitfall 4) | WH-05 (physical inventory counts) | All adjustment entries are readable (no UPDATE/DELETE). Audit trail exists for every adjustment. |
| Permission issues (Pitfall 5) | WH-01 (multi-location setup) | User A (Warehouse A only) cannot see/use Warehouse B. Cross-warehouse role exists and works as expected. |
| Migration integrity (Pitfall 6) | WH-02 (location migration) | Pre/post migration reconciliation passes. All service call sites updated to pass locationId. Rollback tested. |
| UI/UX errors (Pitfall 7) | WH-01 + PR-01 (first warehouse and KG UI) | Warehouse is top-level context, not a form field. KG price shows formula breakdown. Stock indicator visible per warehouse. |

## Sources

- **Codebase analysis:** StockLedgerEntry lacks locationId (prisma/schema.prisma:503-533). BulkStockLedgerEntry has locationId as the reference pattern (prisma/schema.prisma:843-868). ItemPrice has price but no pricePerKg yet (prisma/schema.prisma:347-360).
- **CONCERNS.md:** Cross-tenant data corruption via unscoped party lookups (prior IDOR bug) — demonstrates real-world data integrity risk in this codebase. Technical debt patterns that affect warehouse correctness.
- **PROJECT.md:** Active features WH-01 through WH-05 and PR-01 through PR-03 — all at risk from the pitfalls documented above.
- **Existing transfer bug (ERPNext Forum):** Real-world report of stock being reduced/added twice during warehouse transfers due to duplicate Stock Ledger Entries. Confirms double-counting risk is not theoretical.
- **LPGSoft / Xerafy industry research:** Confirms LPG cylinder tracking challenges include stock mismatches, loss tracking, and location visibility as common failure modes in the industry.
- **Inventory ERP Migration (Cloud Accounting):** Documents the common pattern of treating migration as a simple data transfer rather than considering balance chains, location scoping, and the interconnected nature of inventory data.

---

*Pitfalls research for: LPG Cylinder Warehouse Management & KG-Based Pricing*
*Researched: 2026-06-25*
