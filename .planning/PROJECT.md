# LPG Management System

## What This Is

A multi-tenant ERP for LPG (Liquefied Petroleum Gas) cylinder distribution shops in Pakistan. Manages cylinder inventory (filled/empty tracking), double-entry accounting, customer/vendor management, sales/purchases/returns, bulk import operations, and financial reporting — all in a single Next.js app with PostgreSQL.

## Core Value

Accurate cylinder stock and financial accounting across every transaction — every filled cylinder sold, every empty returned, every rupee must balance at day's close.

## Requirements

### Validated

- ✓ Cylinder stock tracking via append-only StockLedgerEntry (filled/empty, in/out) — existing
- ✓ Purchase of filled cylinders from vendors — existing
- ✓ Sale of LPG in filled cylinders to customers — existing
- ✓ Empty cylinder returns from customers — existing
- ✓ Purchase returns to vendors — existing
- ✓ Double-entry accounting with balanced vouchers — existing
- ✓ Multi-tenant isolation by companyId + financialYearId — existing
- ✓ RBAC with role-based permissions — existing
- ✓ Document numbering (per-company/year sequenced) — existing
- ✓ Customer/vendor management — existing
- ✓ Item/brand/category management — existing
- ✓ Cylinder weight tracking (cylinderWeightKg on Item) — existing
- ✓ Customer cylinder balances (filledOutstanding, emptyOwed, securityHeld) — existing
- ✓ Vendor cylinder return balances — existing
- ✓ Bulk LPG import trading (Taftan/Ship imports, plants, bowsers) — existing
- ✓ Plant/bulk stock with separate BulkStockLedgerEntry — existing
- ✓ Stock locations (PLANT, IMPORT_TERMINAL, IN_TRANSIT, WAREHOUSE types) — existing
- ✓ Day closing, audit logging — existing
- ✓ Reports (sales, purchases, stock ledger, P&L, bank book, etc.) — existing

### Active

- [ ] **WH-01**: Multi-location cylinder stock tracking — track filled/empty cylinder inventory across multiple warehouse locations
- [ ] **WH-02**: Warehouse location on StockLedgerEntry — add locationId to cylinder stock ledger for location-aware inventory
- [ ] **WH-03**: Warehouse transfers — transfer cylinders between warehouses with proper stock ledger entries
- [ ] **WH-04**: Warehouse receipt/dispatch — record incoming and outgoing cylinder stock at warehouse level
- [ ] **WH-05**: Warehouse-level physical inventory counts — record and reconcile inventory counts per warehouse
- [ ] **PR-01**: KG-based pricing on ItemPrice — add pricePerKg field for auto-calculation: total = pricePerKg × cylinderWeightKg
- [ ] **PR-02**: KG pricing in purchase transactions — auto-calculate purchase price from KG rate when buying cylinders
- [ ] **PR-03**: KG pricing in sale transactions — auto-calculate sale price from KG rate when selling cylinders

### Out of Scope

- Mobile app or native client — web-only, responsive design
- Real-time IoT cylinder tracking — manual inventory management
- E-commerce / online ordering — in-person/desktop ERP operations
- Multi-language support beyond English — locale support deferred
- Third-party POS hardware integration — manual entry only

## Context

This is an established LPG cylinder distribution ERP already in production use. The codebase follows a layered monolith pattern on Next.js 15 App Router with Prisma/PostgreSQL. Business logic lives in domain services under `src/server/services/`. The existing StockLedgerEntry tracks cylinder stock but has no warehouse/location field — all cylinder stock is implicitly at a single plant. The existing StockLocation and BulkStockLedgerEntry models serve the bulk LPG import domain and already support a WAREHOUSE location type. The Item model already carries cylinderWeightKg, and ItemPrice carries fixed pricing — the KG-based pricing will add pricePerKg alongside the existing price field.

## Constraints

- **Tech stack**: Next.js 15, React 19, Prisma 6, PostgreSQL 16, Tailwind CSS 3 — no new runtime dependencies
- **Database**: Append-only stock ledger invariant must not be violated — all stock movements produce immutable entries
- **Accounting**: Every financial transaction must produce a balanced double-entry voucher (debits == credits)
- **Tenancy**: Every query must scope by companyId and financialYearId — multi-tenant isolation is mandatory
- **Existing patterns**: Follow established code conventions — service layer, thin API handlers, Prisma transactions, permission enforcement per service call

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add locationId to StockLedgerEntry | Simplest approach leveraging existing patterns; StockLocation model already exists with WAREHOUSE type | — Pending |
| pricePerKg on ItemPrice | Auto-calculates total = pricePerKg × cylinderWeightKg; supports customer-specific pricing | — Pending |
| KG pricing for both purchases and sales | Consistent pricing model across all cylinder transactions | — Pending |

---

*Last updated: 2026-06-25 after initialization*
