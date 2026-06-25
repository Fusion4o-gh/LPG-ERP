# Project Research Summary

**Project:** LPG Management System
**Domain:** LPG Cylinder Distribution ERP — Warehouse Management & KG-Based Pricing
**Researched:** 2026-06-25
**Confidence:** HIGH

## Executive Summary

This research covers the **warehouse management** and **KG-based pricing** features needed to extend an established LPG cylinder distribution ERP (Next.js/Prisma/PostgreSQL) from single-location stock tracking to multi-warehouse operations with per-kg pricing.

**Key finding:** The warehouse features (WH-01 through WH-05) and pricing features (PR-01 through PR-03) are technically independent — they modify different models and services. They can (and should) be implemented in parallel. The foundation for all warehouse features is adding `locationId` to the existing `StockLedgerEntry` model. KG pricing requires adding `pricePerKg` to `ItemPrice` and updating the calculation in purchase/sale services.

**Critical risk:** During physical inventory counts (WH-05), concurrent transactions at the same warehouse location will produce irreconcilable discrepancies. The system must implement location-level transaction freezing during counts — suspend all stock movements into/out of a location while counting is in progress.

**Competitive landscape:** Competing products (Gasflow, Cylstock, Tarsil, MDIT) offer multi-warehouse stock tracking and inter-branch transfers, but none combine: (1) immutable append-only stock ledger, (2) built-in double-entry accounting per transaction, and (3) unified KG pricing across purchase and sale. These three differentiators are already partially built in the existing codebase — the warehouse work extends them with location awareness.

## Key Findings

### Recommended Stack

No new runtime dependencies required. The existing stack (Next.js 15, React 19, Prisma 6, PostgreSQL 16, Tailwind CSS 3) handles all warehouse and KG pricing requirements. The StockLocation model already exists with a WAREHOUSE type. The Item model already carries `cylinderWeightKg`. The ItemPrice model already supports customer-specific pricing.

**Key schema changes needed:**
- `StockLedgerEntry.locationId` — nullable BigInt FK to StockLocation (null = legacy entries before multi-warehouse)
- `ItemPrice.pricePerKg` — Decimal(10,2), nullable for items priced per-cylinder (fixed price)
- `PhysicalCount` — new model for count header (warehouse, date, status)
- `PhysicalCountLine` — new model for line items (filled/empty, counted qty, ledger qty, variance)
- `WarehouseTransfer` — new model for transfer header (source, destination, date, status)
- `WarehouseTransferLine` — new model for line items (filled/empty, quantity, transfer status)

### Expected Features

**Must have (table stakes):**
- Multi-warehouse filled/empty cylinder stock tracking (WH-01, WH-02)
- Inter-warehouse cylinder transfers with dispatch/receipt workflow (WH-03)
- Warehouse receipt and dispatch on existing purchase/sale flows (WH-04)
- KG-based pricing (pricePerKg x cylinderWeightKg) on ItemPrice, purchase, and sale (PR-01, PR-02, PR-03)
- Stock report by warehouse

**Should have (competitive):**
- Physical inventory counts with ledger reconciliation and adjustment workflow (WH-05)
- Warehouse transfer history report
- Inventory valuation report (combines KG pricing with stock quantities)

**Defer (v2+):**
- Barcode/QR code scanning
- Customer cylinder holding per warehouse
- Individual cylinder serial number tracking
- Mobile app for field delivery staff

### Architecture Approach

Extend the existing layered monolith — add `locationId` to the immutable `StockLedgerEntry`, create a `WarehouseTransfer` domain service (mirrors existing transfer patterns), add `pricePerKg` to `ItemPrice`, and create a `PhysicalCount` domain service with location-level transaction freeze. All new features follow existing patterns: service layer, thin API handlers, Prisma transactions, permission enforcement per call.

**Major components:**
1. **StockLedgerEntry (modified)** — add `locationId` for location-aware append-only stock tracking
2. **ItemPrice (modified)** — add `pricePerKg` for KG-based pricing alongside fixed pricing
3. **WarehouseTransferService (new)** — inter-warehouse transfer with dual ledger entry (dispatch + receipt)
4. **PhysicalCountService (new)** — count creation, ledger comparison, adjustment posting with location freeze
5. **Report services (enhanced)** — stock-by-warehouse, transfer-history, inventory-valuation reports

### Critical Pitfalls

1. **Concurrent transactions during physical count** — counting stock while transfers/sales are in progress produces irreconcilable ledger-vs-count differences. Solution: location-level freeze during count (block new transactions at that location, allow fallback to "count in progress" status with warning).
2. **Incorrect default location for legacy entries** — existing StockLedgerEntry records have no location. Defaulting them to "main warehouse" may produce misleading historical reports. Solution: keep locationId nullable, treat null as "unknown location" in reports.
3. **Mismatched KG pricing between purchase and sale** — if purchase uses pricePerKg but sale uses a different rate, margin calculations break. Solution: enforce the same pricePerKg from the ItemPrice record for both sides within the same transaction.
4. **Transfer in-flight stock visibility** — during an inter-warehouse transfer, cylinders are deducted from source but not yet received at destination. The system must show a clear "in transit" status. Solution: add an IN_TRANSIT status to the StockLocation enum and show in-transit quantities in reports.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Location-Aware Stock Ledger + KG Pricing Schema
**Rationale:** Warehouse features share one dependency (locationId on StockLedgerEntry). KG pricing is independent (pricePerKg on ItemPrice). Both are schema changes that everything else builds on. Do them first.
**Delivers:** Schema migrations for locationId and pricePerKg. Updated Prisma models. Basic queries still work.
**Addresses:** WH-01, WH-02, PR-01
**Avoids:** Pitfall of building features on top of a schema that will change

### Phase 2: Warehouse Transactions — Transfers + Receipt/Dispath
**Rationale:** With location-aware ledger in place, implement the inter-warehouse transfer service. Update existing purchase receipt and sale dispatch to record the location.
**Delivers:** WarehouseTransferService, location-aware purchase/sale flows, transfer history readable from ledger.
**Addresses:** WH-03, WH-04
**Avoids:** Pitfall of in-transit stock visibility (IN_TRANSIT location status)

### Phase 3: KG Pricing in Transactions
**Rationale:** With pricePerKg on ItemPrice, update purchase and sale services to use the KG calculation. Can be done in parallel with Phase 2 since it touches different code.
**Delivers:** KG-based price calculation in purchase and sale transactions.
**Addresses:** PR-02, PR-03
**Avoids:** Pitfall of mismatched KG pricing between purchase and sale (use same pricePerKg record)

### Phase 4: Reports — Stock by Warehouse, Transfer History, Valuation
**Rationale:** Requires data from Phases 2 and 3. No new functionality, just query/display.
**Delivers:** Stock report by warehouse, transfer history report, inventory valuation report.
**Addresses:** Reporting features from FEATURES.md
**Avoids:** Reporting on empty data (phases 2+3 must have happened first)

### Phase 5: Physical Inventory Counts
**Rationale:** Most complex feature. Requires count model, location freeze mechanism, adjustment workflow. Depends on location-aware ledger being stable.
**Delivers:** PhysicalCountService with approval workflow for adjustments.
**Addresses:** WH-05
**Avoids:** Pitfall of concurrent transactions during count (location freeze)

### Phase Ordering Rationale

- **Phases 1-3 are independent and parallelizable** — schema changes (Phase 1) must go first, but warehouse transactions (Phase 2) and KG pricing (Phase 3) touch disjoint code paths and can be done by separate AI agents simultaneously.
- **Phase 4 depends on Phase 2+3** — Reports need data. Don't build report screens until the underlying services are generating records.
- **Phase 5 is intentionally last** — Physical counts are the most complex and have the highest risk of data integrity issues. Let the warehouse transaction patterns stabilize before introducing the freeze/adjustment workflow.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Physical Counts):** Need to research database-level locking strategies for the location freeze. PostgreSQL advisory locks vs. application-level status flag. Impact on concurrent users.
- **Phase 4 (Reports):** Need to research optimal aggregation queries for large StockLedgerEntry datasets. Materialized views vs. live aggregation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema changes):** Straightforward Prisma migrations. No research needed.
- **Phase 2 (Transfers):** Follows existing service patterns. No research needed.
- **Phase 3 (KG pricing):** Follows existing transaction patterns. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Features | HIGH | Direct competitor analysis validated. Market research from 6+ LPG software products confirms feature expectations. |
| Architecture | HIGH | Extends existing, proven patterns. No novel architectural challenges. Immutable ledger pattern is well-understood. |
| Pitfalls | HIGH | Pitfalls are based on real operational scenarios observed in competitor case studies (VasyERP, Gasflow blog) and common ERP implementation patterns. |
| Pricing Model | HIGH | OGRA pricing methodology (rate per kg x cylinder weight) is the well-documented standard in Pakistan. Confirmed by multiple sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Concurrent count strategy:** Need to determine whether PostgreSQL advisory locks or an application-level lock table is more appropriate for location freezing. This is a Phase 5 implementation detail, not a research gap.
- **Transfer in-transit duration:** What happens if a transfer is initiated but never confirmed at destination? Need timeout/stale-transfer cleanup logic. Decision needed during Phase 2 design.
- **Null locationId reporting:** How should reports handle legacy StockLedgerEntry records (null locationId)? Current assumption: show as "Unassigned" in reports. Validate with users.

## Sources

### Primary (HIGH confidence)
- OGRA LPG pricing methodology — government-notified rate per kg, confirmed across multiple Pakistani news sources and official portal
- Gasflow.pk feature set — most direct competitor in Pakistan, validated multi-branch stock tracking and inter-branch transfer features
- Cylstock.com feature set — comprehensive feature coverage across cylinder inventory management domain
- VasyERP case study — validated operational challenges: manual inventory, lack of real-time tracking, duplicate empty cylinder record automation

### Secondary (MEDIUM confidence)
- Tarsil.pk feature set — LPG delivery software with rider tracking, zone routing
- MDIT LPG Smart Store feature set — multi-warehouse, filled/empty tracking from Bangladesh market
- CTMS (ctmsgas.com) — QR tracking, stock transfer module, dispute tracking
- LPGSoft by YoungMinds — inventory management, delivery management features

### Tertiary (LOW confidence)
- General multi-warehouse inventory management best practices from generic ERP sources (Kardex, ShipBob, Linnworks) — patterns are transferable but not LPG-specific

---

*Research completed: 2026-06-25*
*Ready for roadmap: yes*
