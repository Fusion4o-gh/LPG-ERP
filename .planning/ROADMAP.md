# Roadmap: LPG Management System

## Overview

The LPG Management System is an established multi-tenant ERP for LPG cylinder distribution shops in Pakistan — already in production use. The existing system covers cylinder sales, purchases, returns, append-only stock ledger, double-entry accounting, RBAC, bulk LPG import trading, and financial reporting. This roadmap extends the system with multi-warehouse cylinder stock tracking, inter-warehouse transfers, KG-based pricing, and physical inventory management — all following existing code conventions and building on the proven append-only stock ledger pattern.

**Milestone:** v1.1 — Warehouse Management & KG Pricing (Active)
**Milestone Goal:** Add multi-warehouse cylinder stock tracking, inter-warehouse transfers, KG-based pricing, and physical inventory management to the existing single-location ERP.

## Phases

- [x] **Phase 1: Foundation & Setup** — Company setup, financial years, user management, RBAC
- [x] **Phase 2: Master Data & Inventory** — Items, customers, vendors, cylinder stock ledger
- [x] **Phase 3: Core Transactions** — Purchase, sale, and return of cylinders
- [x] **Phase 4: Accounting & Compliance** — Double-entry accounting, day closing, audit, reports
- [x] **Phase 5: Bulk Import & Financial Adjustments** — Bulk LPG trading, dollar transactions, adjustments
- [ ] **Phase 6: Warehouse Management & KG Pricing** — Multi-warehouse stock tracking, transfers, KG-based pricing, physical inventory counts

## Phase Details

### Phase 1: Foundation & Setup (Complete)

**Goal**: Company and financial infrastructure, user management, and role-based access control
**Depends on**: Nothing (first phase)
**Requirements**: Existing — No formal requirement IDs
**Success Criteria** (what was delivered):

  1. User can create and manage companies with multi-tenant isolation
  2. User can define financial years and open/close them
  3. User can create users with role-based permissions
  4. User login enforces RBAC scoped by companyId

**Status**: Complete
**Plans**: N/A (past milestone)

---

### Phase 2: Master Data & Inventory (Complete)

**Goal**: Item/brand/category catalog, customer and vendor management, cylinder stock ledger
**Depends on**: Phase 1
**Requirements**: Existing — No formal requirement IDs
**Success Criteria** (what was delivered):

  1. User can create and manage items with brand, category, and cylinderWeightKg
  2. User can manage customer and vendor records
  3. System maintains append-only StockLedgerEntry for filled/empty cylinder stock
  4. Stock availability queries return real-time balances

**Status**: Complete
**Plans**: N/A (past milestone)

---

### Phase 3: Core Transactions (Complete)

**Goal**: Purchase of filled cylinders, LPG sales, and empty cylinder returns
**Depends on**: Phase 2
**Requirements**: Existing — No formal requirement IDs
**Success Criteria** (what was delivered):

  1. User can purchase filled cylinders from vendors with auto-stock-in
  2. User can sell LPG in filled cylinders to customers with auto-stock-out
  3. User can process empty cylinder returns from customers
  4. User can process purchase returns to vendors
  5. Every transaction creates balanced double-entry vouchers

**Status**: Complete
**Plans**: N/A (past milestone)

---

### Phase 4: Accounting & Compliance (Complete)

**Goal**: Double-entry accounting, day closing, audit logging, and financial reports
**Depends on**: Phase 3
**Requirements**: Existing — No formal requirement IDs
**Success Criteria** (what was delivered):

  1. System maintains a chart of accounts with double-entry voucher posting
  2. User can view account-wise transaction history
  3. Day closing ensures all transactions balance before close
  4. Audit log captures all data-modifying operations
  5. Reports (sales, purchases, stock, P&L, bank book) are available

**Status**: Complete
**Plans**: N/A (past milestone)

---

### Phase 5: Bulk Import & Financial Adjustments (Complete)

**Goal**: Bulk LPG import trading, dollar transactions, loss/gain adjustments
**Depends on**: Phase 4
**Requirements**: Existing — No formal requirement IDs
**Success Criteria** (what was delivered):

  1. User can manage bulk LPG import contracts with loading/unloading tracking
  2. User can manage plant inventory and local bulk purchases
  3. User can perform inter-plant bulk stock transfers
  4. Dollar-denominated transactions are handled with FX conversion
  5. Loss/gain adjustments are recorded against bulk stock

**Status**: Complete
**Plans**: N/A (past milestone)

---

### Phase 6: Warehouse Management & KG Pricing (Active)

**Goal**: Add multi-warehouse cylinder stock tracking, inter-warehouse transfers, KG-based pricing, and physical inventory management
**Mode**: mvp
**Depends on**: Phase 5
**Requirements**: WH-01, WH-02, WH-03, WH-04, WH-05, PR-01, PR-02, PR-03
**Success Criteria** (what must be TRUE):

  1. StockLedgerEntry has locationId and queries show stock by warehouse
  2. Users can transfer cylinders between warehouses with dispatch/receipt workflow
  3. Purchase/sale flows record warehouse location
  4. Price per KG auto-calculates cylinder prices (pricePerKg × cylinderWeightKg)
  5. Users can perform physical inventory counts per warehouse and post adjustments
  6. All existing tests still pass; new tests cover warehouse and KG pricing features
  7. TypeScript compilation clean

**Status**: Planned
**Plans**: 1/4 plans executed
**UI hint**: yes

Plans:

- [x] 06-01-PLAN.md — Schema & Foundation: Prisma migrations, location-aware stock ledger, StockLocation CRUD, WarehouseSelector
- [ ] 06-02-PLAN.md — Warehouse Transfers: atomic OUT/IN transfer service + API + UI + cancel workflow
- [ ] 06-03-PLAN.md — KG Pricing & Warehouse Receipt/Dispatch: kg-pricing service, locationId + KG pricing in sale/purchase flows, UI
- [ ] 06-04-PLAN.md — Physical Counts & Stock-by-Location Report: count service with adjustment posting, stock report by warehouse

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Setup | — | Complete | Past milestone |
| 2. Master Data & Inventory | — | Complete | Past milestone |
| 3. Core Transactions | — | Complete | Past milestone |
| 4. Accounting & Compliance | — | Complete | Past milestone |
| 5. Bulk Import & Financial Adjustments | — | Complete | Past milestone |
| 6. Warehouse Management & KG Pricing | 1/4 | In Progress|  |
