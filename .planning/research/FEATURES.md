# Feature Research

**Domain:** LPG Cylinder Distribution ERP — Warehouse Management & KG-Based Pricing
**Researched:** 2026-06-25
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every LPG cylinder distribution ERP in Pakistan offers. Missing these = product feels incomplete vs. competitors like Gasflow, Cylstock, Tarsil, and MDIT.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-warehouse cylinder stock tracking** | LPG dealers operate multiple godowns/branches; they need to see filled vs. empty counts per location at a glance | MEDIUM | `locationId` on StockLedgerEntry; leverages existing StockLocation model with WAREHOUSE type. Must not violate append-only invariant. |
| **Inter-warehouse cylinder transfers** | Moving stock between branches is daily reality; without a formal transfer, physical stock and system stock diverge | MEDIUM | Two stock ledger entries (dispatch from source, receipt at destination). Must maintain filled/empty separation during transfer. |
| **Warehouse receipt (GRN) workflow** | When filled cylinders arrive from supplier or another warehouse, the receiving location needs to record what came in | LOW | Leverage existing purchase receipt pattern. Add location context to the inbound stock ledger entry. |
| **Warehouse dispatch workflow** | When cylinders leave a warehouse (sale, transfer, return to supplier), dispatch must be recorded against that location | LOW | Leverage existing sale/dispatch pattern. Add location context to the outbound stock ledger entry. |
| **Physical inventory count & reconciliation** | Monthly/quarterly counts are standard practice; system must record counts and reconcile against ledger balance per warehouse | MEDIUM | Create count record per location, compare to ledger balance, generate adjustment entries for discrepancies. Adjustments must produce audit trail. |
| **KG-based pricing (pricePerKg × weight = total)** | OGRA publishes LPG rates per kg; dealers calculate cylinder price as rate × cylinder weight. This is how real-world pricing works in Pakistan | LOW | Already have `cylinderWeightKg` on Item and `ItemPrice` model. Add `pricePerKg` field, auto-calculate total. Supports customer-specific pricing. |
| **KG pricing in purchase transactions** | When buying filled cylinders from supplier, the cost is based on per-kg rate × cylinder weight, not a fixed cylinder price | LOW | Extend existing purchase service to accept KG rate, auto-calculate line total from `pricePerKg × cylinderWeightKg`. |
| **KG pricing in sale transactions** | When selling LPG, customer is charged per-kg rate × cylinder weight. Most common pricing model in Pakistan | LOW | Extend existing sale service. Sale price = `pricePerKg × cylinderWeightKg`. Same formula as purchase. |
| **Stock report by warehouse** | Management needs to see current filled/empty stock across all locations from one screen | MEDIUM | Aggregate stock ledger entries grouped by locationId. Show running balance per location per filled/empty type. |
| **Warehouse transfer history report** | Audit trail for all inter-warehouse movements — who moved what, when, from where to where | MEDIUM | Query stock ledger entries filtered by transfer type, grouped by transfer pair. Show origin/destination/timestamp. |
| **Customer cylinder holding tracking per warehouse** | Know which customers have cylinders from which warehouse location | MEDIUM | Existing customer cylinder balances (`filledOutstanding`, `emptyOwed`) need location awareness if a customer serves multiple warehouses. |

### Differentiators (Competitive Advantage)

Features where this system stands apart from typical LPG software in Pakistan.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Immutable append-only stock ledger per location** | Every stock movement produces an auditable, non-rewritable entry. No competitor offers bulletproof audit trail — they use mutable balance fields | MEDIUM | Core architectural choice. Extend existing StockLedgerEntry with locationId. Never UPDATE balances — always INSERT entries. |
| **Unified KG pricing across purchase and sale sides** | Price consistency: the same per-kg rate applies whether buying from supplier or selling to customer. Eliminates margin calculation errors | LOW | `pricePerKg` on ItemPrice applies to both purchase and sale transactions. Customer-specific pricing via company-specific ItemPrice records. |
| **Double-entry accounting integrated with warehouse movements** | Every stock movement produces a balanced journal entry. Not just inventory tracking — real financial accounting built in | MEDIUM | Existing voucher system extends to warehouse transactions. Transfers-between-warehouses = no P&L impact (asset location change). Stock adjustments = P&L impact. |
| **Bulk LPG import + warehouse cylinder stock in one system** | Dealers who import bulk LPG via Taftan or ship and also sell cylinders have both domains in one system with unified reporting | HIGH | Existing bulk stock (BulkStockLedgerEntry) and cylinder stock (StockLedgerEntry) both get location awareness. Unique integration not found in most LPG software. |
| **Multi-tenant with per-financial-year data isolation** | Single instance serves multiple companies (dealerships) with guaranteed data separation | MEDIUM | Already built. Warehouse/location data must respect `companyId` and `financialYearId` scoping. |
| **Auto-generated adjustment entries from physical counts** | When count vs ledger discrepancy is found, system proposes/adjusts entries automatically rather than requiring manual stock correction vouchers | MEDIUM | Compare count to ledger, generate suggested adjustment entries, require approval, then post. Full audit trail of the reconciliation. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems at this stage of the project.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Individual cylinder serial number / barcode tracking** | "Track every cylinder by its serial number for complete traceability" | Massive data entry overhead. Every cylinder receipt requires scanning 100+ serials. Value is marginal when the business operates on filled/empty counts, not individual identity. Most LPG software in Pakistan tracks by quantity, not serial. | Track by filled/empty quantity per warehouse. Add serial/barcode as a future enhancement if demand justifies. |
| **Real-time GPS vehicle tracking for cylinder delivery** | "Know where each delivery vehicle is in real time" | Requires IoT/telematics integration, mobile apps, GPS hardware. Completely out of scope for a web-only ERP. The delivery confirmation workflow doesn't need live GPS. | Track dispatch from warehouse and receipt at customer as discrete ledger events. No live tracking needed. |
| **Automated cylinder hydrotest/compliance scheduling** | "Safety regulations require periodic cylinder testing" | Adds regulatory compliance domain that requires date tracking per cylinder batch/serial. Only meaningful if tracking individual cylinders, which is an anti-feature above. | Defer to v2+ if customers demand it. For now, manual note on customer/vendor record suffices. |
| **Mobile app for field staff delivery confirmation** | "Delivery boys need to confirm delivery on their phones" | Requires separate mobile app development, push notifications, offline sync. Stated out of scope in PROJECT.md. | Desktop-based dispatch workflow with manual delivery confirmation. Consider mobile web responsive design as a middle ground. |
| **Automated reorder point / low stock alerts** | "Alert me when stock falls below X at any warehouse" | Requires configurable thresholds per item per warehouse, notification infrastructure. Adds complexity without clear ROI for an ERP where the owner checks stock daily anyway. | Simple stock report that shows current vs min/max. Owner checks manually. |
| **Lot/batch tracking per cylinder fill** | "Know which batch of LPG was used to fill each cylinder" | Requires tracking LPG source batch to cylinder fill — essentially production tracking for filling plants. This is a filling plant management domain, not a distribution ERP domain. | Not applicable for distribution-only ERP. If filling plants are added later, this becomes relevant as a separate module. |

## Feature Dependencies

```
WH-01: Multi-warehouse cylinder stock tracking
    └──requires──> locationId on StockLedgerEntry (schema change)
    └──requires──> StockLocation model (exists with WAREHOUSE type)

WH-02: Warehouse location on StockLedgerEntry
    └──requires──> WH-01 (schema migration)

WH-03: Inter-warehouse transfers
    └──requires──> WH-02 (location-aware ledger)
    └──requires──> Transfer service (new domain service)
        └──requires──> Permission check for transfer operation

WH-04: Warehouse receipt/dispatch
    └──requires──> WH-02 (location-aware ledger)
    └──enhances──> Existing purchase receipt and sale dispatch

WH-05: Physical inventory counts
    └──requires──> WH-02 (location-aware ledger)
    └──requires──> Count model and adjustment workflow
    └──conflicts──> Any concurrent transfer/transaction during count (count freeze needed)

PR-01: KG-based pricing on ItemPrice
    └──requires──> cylinderWeightKg on Item (exists)
    └──requires──> ItemPrice model (exists)
    └──requires──> pricePerKg field addition to ItemPrice schema

PR-02: KG pricing in purchase
    └──requires──> PR-01 (pricePerKg available)
    └──enhances──> Purchase service
        └──requires──> Calculation: total = pricePerKg × cylinderWeightKg

PR-03: KG pricing in sale
    └──requires──> PR-01 (pricePerKg available)
    └──enhances──> Sale service
        └──requires──> Calculation: total = pricePerKg × cylinderWeightKg

Stock report by warehouse
    └──requires──> WH-02 (location data populated in ledger)

Transfer history report
    └──requires──> WH-03 (transfer service creates the records)

Inventory valuation report
    └──requires──> PR-01 (KG rates available for valuation)
    └──requires──> WH-02 (stock quantities per location)
```

### Dependency Notes

- **WH-01/WH-02 is the foundation:** Every warehouse feature builds on adding locationId to StockLedgerEntry. Without this, nothing else works. This is phase 1.
- **PR-01 is independent of warehouse features:** KG pricing can be implemented in parallel with warehouse features since it only touches ItemPrice and the transaction services. No location dependency.
- **WH-05 (physical counts) needs transaction freeze:** During a physical count at a warehouse, you cannot allow concurrent stock movements in/out of that location or the reconciliation becomes impossible. Must implement location-level locking or a count-in-progress status.
- **Reports depend on data being populated:** No point building the stock report until WH-02 is live and location data is being recorded on transactions.

## MVP Definition

### Launch With (Phase: Warehouse & KG Pricing)

Based on research, these features form the minimum viable addition to the existing ERP:

- [ ] **WH-02 (locationId on StockLedgerEntry)** — Foundation for all warehouse features. Schema migration + update all existing stock ledger queries to include location context.
- [ ] **WH-01 (multi-warehouse stock tracking)** — CRUD for warehouse locations, view stock per location from dashboard.
- [ ] **WH-04 (warehouse receipt/dispatch)** — Existing purchase/sale flow gets location-aware. Without this, every transaction defaults to a single location and WH-01 shows zero stock.
- [ ] **WH-03 (inter-warehouse transfers)** — Core operational need. Moving cylinders between branches without creating fake purchase/sale transactions.
- [ ] **PR-01, PR-02, PR-03 (KG pricing)** — Complete KG pricing across ItemPrice, purchase, and sale. This is how LPG dealers actually price — by per-kg rate × cylinder weight.
- [ ] **Stock report by warehouse** — Minimal report showing current filled/empty per location. Without this, the warehouse data has no visibility.

### Add After Validation (Next Phase)

- [ ] **WH-05 (physical inventory counts)** — Requires count freeze logic, adjustment approval workflow. Non-trivial, but critical for accuracy. Add once warehouse transactions are stable.
- [ ] **Warehouse transfer history report** — Only useful once WH-03 has been in use and generated enough data.
- [ ] **Inventory valuation report** — Combines KG pricing (PR-01) with stock quantities per warehouse. Valuable for financial reporting.

### Future Consideration (v2+)

- [ ] **Barcode/QR code scanning integration** — Defer until users explicitly request it. The quantity-based approach works for most Pakistani LPG dealers.
- [ ] **Customer cylinder holding per warehouse** — Current customer balance model is company-wide. Making it location-aware adds complexity. Defer until multi-warehouse multi-customer patterns emerge.
- [ ] **Individual cylinder serial tracking** — Only if a regulatory requirement emerges. Adds 10x data entry overhead for marginal traceability value.
- [ ] **Mobile app for delivery staff** — Out of scope per PROJECT.md. Revisit if competitive pressure demands it.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| WH-02: locationId on StockLedgerEntry | HIGH | MEDIUM | P1 |
| WH-01: Multi-warehouse stock tracking | HIGH | MEDIUM | P1 |
| WH-04: Warehouse receipt/dispatch | HIGH | LOW | P1 |
| WH-03: Inter-warehouse transfers | HIGH | MEDIUM | P1 |
| PR-01: KG pricing on ItemPrice | HIGH | LOW | P1 |
| PR-02: KG pricing in purchase | HIGH | LOW | P1 |
| PR-03: KG pricing in sale | HIGH | LOW | P1 |
| Stock report by warehouse | MEDIUM | MEDIUM | P1 |
| WH-05: Physical inventory counts | MEDIUM | HIGH | P2 |
| Transfer history report | LOW | MEDIUM | P2 |
| Inventory valuation report | LOW | MEDIUM | P2 |
| Barcode/QR scanning | LOW | HIGH | P3 |
| Customer cylinder holding per warehouse | LOW | HIGH | P3 |

**Priority key:**
- **P1:** Must have for launch — without these, warehouse/KG features are incomplete or invisible
- **P2:** Should have, add in next phase — valuable but not blocking
- **P3:** Nice to have, future consideration — defer until validated demand

## Competitor Feature Analysis

| Feature | Gasflow (PK) | Cylstock (IN) | Tarsil (PK) | MDIT (BD) | Our Approach |
|---------|-------------|---------------|-------------|-----------|--------------|
| Multi-branch/warehouse stock | Yes — multi-branch with inter-branch transfers | Yes — multi-branch management | Yes — zone-wise routing | Yes — multiple warehouses | Same, but with immutable ledger instead of mutable balances |
| Filled/empty cylinder tracking | Yes — real-time inventory | Yes — filled, empty, damaged, reserved | Yes — stock via delivery tracking | Yes — refill & return | Same, with location-level breakdown |
| Inter-branch transfers | Yes — with audit trail | Yes — stock transfer module | Not explicit in features | Yes | Same two-entry pattern, but audit trail is guaranteed by design (append-only) |
| KG-based pricing | Not explicit (likely per-cylinder fixed pricing) | Not explicit | Not explicit | Not explicit | **Differentiator:** pricePerKg × cylinderWeightKg for both purchase and sale |
| Physical inventory count | Not explicit | Not explicit | Not explicit | Not explicit | Built-in count vs ledger reconciliation with adjustment workflow |
| Double-entry accounting | External integration likely | GST billing only | Not explicit | Not explicit | **Differentiator:** Built-in balanced voucher per transaction |
| Append-only audit trail | Not advertised | Not advertised | Not advertised | Not advertised | **Differentiator:** Core architecture — StockLedgerEntry is immutable |
| Bulk LPG import integration | Not offered | Not offered | Not offered | Not offered | **Differentiator:** Combined bulk + cylinder in one ERP |
| Mobile app for field staff | Yes — team app with field booking | Yes — mobile app support | Yes — rider app with live tracking | Not explicit | **Deferred:** Out of scope — web-only |
| Barcode/QR support | Not explicit | Yes — barcode & QR integration | Not explicit | Not explicit | **Deferred:** Quantity-based tracking for MVP |

## Sources

- **Competitor products analyzed:**
  - Gasflow (gasflow.pk) — Pakistani LPG business management platform. Features: multi-branch management, real-time inventory tracking, inter-branch transfers, team mobile app, udhaar/credit management. Most direct competitor in Pakistan.
  - Cylstock (cylstock.com) — Indian cylinder inventory & tracking software. Features: barcode/QR, multi-branch, vehicle tracking, hydrotest compliance, GST billing.
  - Tarsil (tarsil.pk) — Pakistani LPG cylinder delivery software. Features: rider mobile app with GPS, zone-wise routing, "sleeping customer" monitoring, delivery confirmation.
  - MDIT LPG Smart Store (microdreamit.com) — Bangladeshi LPG cylinder store management. Features: multi-warehouse, filled/empty/refill tracking, LPG & general customer types, role-based access.
  - CTMS (ctmsgas.com) — Cylinder tracking management system. Features: QR tracking, stock transfer module, purchase order/invoice management, dispute tracking.
  - LPGSoft by YoungMinds (ymtsindia.com) — Indian LPG gas software. Features: real-time stock tracking, empty & filled cylinder management, delivery management, WhatsApp notifications.

- **Domain research:**
  - OGRA LPG pricing methodology (price per kg × cylinder weight) — validated as the standard pricing model in Pakistan
  - Gasflow blog on real-time inventory tracking — documented 4–8% stock discrepancy with paper records, dropping to <1% with digital tracking
  - VasyERP case study on LPG gas agency — challenges included lack of real-time stock tracking, duplicate empty cylinder feature, customer verification
  - Industry warehouse management patterns — multi-warehouse, inter-warehouse transfers, physical inventory reconciliation best practices

- **Project context:**
  - PROJECT.md defines existing capabilities and active/out-of-scope features
  - Existing StockLedgerEntry, StockLocation, Item (with cylinderWeightKg), ItemPrice models

---

*Feature research for: LPG Cylinder Distribution ERP — Warehouse Management & KG-Based Pricing*
*Researched: 2026-06-25*
