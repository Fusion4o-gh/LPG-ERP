# Requirements

**Project:** LPG Management System
**Defined:** 2026-06-25
**Version:** 1.0

## User Stories

### WH-01: Multi-Location Cylinder Stock Tracking
> As a warehouse manager, I want to see filled and empty cylinder quantities per warehouse location so I know where my stock is at any time.

**Acceptance Criteria:**
- [ ] WH-01-AC1: StockLedgerEntry has a nullable locationId field referencing StockLocation
- [ ] WH-01-AC2: Users can create Warehouse-type StockLocations
- [ ] WH-01-AC3: balanceAfter is computed per (companyId, itemId, cylinderState, locationId)
- [ ] WH-01-AC4: Null locationId on legacy entries is handled in all queries
- [ ] WH-01-AC5: Stock availability check can be scoped to a specific location

### WH-02: Location-Aware Stock Ledger Service
> As a system, I need the stock ledger service to support location-aware queries and writes so that warehouse transactions can be recorded correctly.

**Acceptance Criteria:**
- [ ] WH-02-AC1: `createStockLedgerEntry` accepts optional locationId
- [ ] WH-02-AC2: `getStockAvailability` accepts optional locationId filter
- [ ] WH-02-AC3: `getStockBalance` returns balances grouped or filtered by location
- [ ] WH-02-AC4: Existing callers (sales, purchases) continue working with null location
- [ ] WH-02-AC5: New stock source type `WAREHOUSE_TRANSFER` added to StockSourceType

### WH-03: Inter-Warehouse Cylinder Transfers
> As a warehouse manager, I want to transfer cylinders from one warehouse to another so I can balance stock across locations.

**Acceptance Criteria:**
- [ ] WH-03-AC1: WarehouseTransfer model created (header: source, destination, date, status, remarks)
- [ ] WH-03-AC2: WarehouseTransferLine model created (item, filled/empty, quantity)
- [ ] WH-03-AC3: Transfer creates OUT entry at source location (balance decreases)
- [ ] WH-03-AC4: Transfer creates IN entry at destination location (balance increases)
- [ ] WH-03-AC5: Both entries created atomically in a single Prisma transaction
- [ ] WH-03-AC6: In-transit stock is visible in reporting (IN_TRANSIT location state)
- [ ] WH-03-AC7: Transfer can be cancelled before receipt (reverses entries)
- [ ] WH-03-AC8: UI for creating transfers with source/destination/item/qty selection
- [ ] WH-03-AC9: UI for listing transfer history

### WH-04: Warehouse Receipt and Dispatch
> As a warehouse manager, I want purchases to record the destination warehouse and sales to record the dispatch warehouse so stock movements are location-aware.

**Acceptance Criteria:**
- [ ] WH-04-AC1: Purchase transactions record destination location for received cylinders
- [ ] WH-04-AC2: Sale transactions record source location for dispatched cylinders
- [ ] WH-04-AC3: UI forms have warehouse selection field for purchase receipt/sale dispatch
- [ ] WH-04-AC4: Location selection is optional (backward compatible with existing flows)
- [ ] WH-04-AC5: Reports show stock movements by warehouse

### WH-05: Physical Inventory Counts and Adjustments
> As a warehouse manager, I want to perform physical inventory counts per warehouse and post adjustments so the ledger matches actual stock.

**Acceptance Criteria:**
- [ ] WH-05-AC1: PhysicalCount model created (location, date, status, counters)
- [ ] WH-05-AC2: PhysicalCountLine model created (item, cylinderState, countedQty, ledgerQty, variance)
- [ ] WH-05-AC3: Location-level freeze prevents transactions during active count
- [ ] WH-05-AC4: Adjustment entries are created for variances (approval workflow)
- [ ] WH-05-AC5: Count history is preserved for audit

### PR-01: KG-Based Pricing on ItemPrice
> As a pricing manager, I want to set a price per KG on items so the system auto-calculates cylinder prices based on weight.

**Acceptance Criteria:**
- [ ] PR-01-AC1: `pricePerKg` field added to ItemPrice model (nullable Decimal)
- [ ] PR-01-AC2: Calculated price = pricePerKg × item.cylinderWeightKg
- [ ] PR-01-AC3: Both fixed price and pricePerKg can coexist (user chooses method)
- [ ] PR-01-AC4: UI for setting/maintaining pricePerKg in item pricing screens
- [ ] PR-01-AC5: Validation: pricePerKg requires cylinderWeightKg on the Item

### PR-02: KG Pricing in Purchase Transactions
> As a purchase manager, when purchasing cylinders, I want the system to auto-calculate the purchase price using the KG rate so I don't have to compute it manually.

**Acceptance Criteria:**
- [ ] PR-02-AC1: Purchase forms show KG rate and calculated price when pricePerKg is set
- [ ] PR-02-AC2: User can accept calculated price or override
- [ ] PR-02-AC3: KG-calculated price flows into accounting vouchers correctly
- [ ] PR-02-AC4: Works with both single and multi-line purchase forms

### PR-03: KG Pricing in Sale Transactions
> As a sales manager, when selling cylinders, I want the system to auto-calculate the sale price using the KG rate so pricing is consistent.

**Acceptance Criteria:**
- [ ] PR-03-AC1: Sale forms show KG rate and calculated price when pricePerKg is set
- [ ] PR-03-AC2: User can accept calculated price or override
- [ ] PR-03-AC3: KG-calculated price flows into accounting vouchers correctly
- [ ] PR-03-AC4: Works with both single and multi-line sale forms

## v1 Requirements

### Warehouse Foundation
- [ ] **WH-01**: Multi-location cylinder stock tracking — locationId on StockLedgerEntry
- [ ] **WH-02**: Location-aware stock ledger service (query/write by location)
- [ ] **WH-03**: Inter-warehouse cylinder transfers with dispatch/receipt workflow
- [ ] **WH-04**: Warehouse receipt/dispatch in purchase and sale flows
- [ ] **WH-05**: Physical inventory counts and adjustments per warehouse

### KG Pricing
- [ ] **PR-01**: KG-based pricing — pricePerKg on ItemPrice, auto-calculated total
- [ ] **PR-02**: KG pricing applied to purchase transactions
- [ ] **PR-03**: KG pricing applied to sale transactions

## v2 Requirements (Deferred)

- Per-location opening stock on financial year start
- Customer cylinder balances per warehouse
- Transfer timeout/stale-cleanup workflow
- Individual cylinder serial number tracking

## Out of Scope

- Barcode/QR code scanning — manual entry for v1
- Mobile app — web-only for v1
- Per-location pricing — one price per item across all locations for v1

## Definition of Done

1. All acceptance criteria for the phase's requirements pass
2. Prisma migrations run cleanly (up and down)
3. TypeScript compilation has zero errors (`npx tsc --noEmit`)
4. All existing tests pass (`npm test`)
5. New tests cover the new functionality
6. Location-scoped queries respect companyId tenancy
7. UI follows existing component patterns

## Traceability

### Past Milestones (Complete)

| Phase | Requirements | Status |
|-------|-------------|--------|
| Phase 1 — Foundation & Setup | Company setup, financial years, user management, RBAC | Complete |
| Phase 2 — Master Data & Inventory | Items, brands, categories, customers, vendors, stock ledger | Complete |
| Phase 3 — Core Transactions | Cylinder purchase, sale, returns | Complete |
| Phase 4 — Accounting & Compliance | Vouchers, day closing, audit, reports | Complete |
| Phase 5 — Bulk Import & Financial Adjustments | Bulk LPG trading, dollar transactions, adjustments | Complete |

### Active Phase

| Phase | Requirements | Status |
|-------|-------------|--------|
| Phase 6 — Warehouse Management & KG Pricing | WH-01, WH-02, WH-03, WH-04, WH-05, PR-01, PR-02, PR-03 | Not started |

---

*Requirements defined: 2026-06-25*
