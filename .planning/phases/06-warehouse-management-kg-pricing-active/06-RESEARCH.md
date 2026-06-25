# Phase 6 Research: Warehouse Management & KG Pricing

## Source Research

This phase builds on project-level research at `.planning/research/`.

### Key Files
- **SUMMARY.md**: `.planning/research/SUMMARY.md` — Executive synthesis, phase ordering, confidence assessment
- **STACK.md**: `.planning/research/STACK.md` — Schema changes, service patterns, UI patterns, anti-patterns
- **FEATURES.md**: `.planning/research/FEATURES.md` — Feature landscape, competitor analysis, prioritization
- **ARCHITECTURE.md**: `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, build order
- **PITFALLS.md**: `.planning/research/PITFALLS.md` — Critical pitfalls, prevention strategies, phase mapping

### Research Confidence: HIGH

All research dimensions returned HIGH confidence. The warehouse and KG pricing features extend existing, proven patterns in the codebase (append-only stock ledger, Prisma transactions, service layer). No new dependencies are needed.

### Key Findings for This Phase

1. **locationId on StockLedgerEntry** — nullable FK to StockLocation, keeps legacy entries backward compatible
2. **pricePerKg on ItemPrice** — coexists with existing `price` field, calculated total = pricePerKg × cylinderWeightKg
3. **WarehouseTransfer** — new model with dual ledger entry (OUT from source, IN to destination) in one Prisma transaction
4. **PhysicalCount** — location-level freeze during counts prevents concurrent transaction discrepancies
5. **StockLocation reuse** — existing model with WAREHOUSE type serves both cylinder and bulk locations

### Phase-Specific Recommendations

| Area | Recommendation |
|------|---------------|
| Schema | locationId nullable first, pricePerKg nullable |
| Transfers | IN_TRANSIT location state already exists in enum |
| UI | Warehouse selector in forms, stock-by-warehouse table |
| Pricing | pricePerKg requires cylinderWeightKg validation |
| Migration | Backfill null location entries as "Unassigned" |

---

*Phase research: 2026-06-25*
