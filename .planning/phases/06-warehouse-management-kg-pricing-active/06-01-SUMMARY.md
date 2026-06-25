---
phase: 06-warehouse-management-kg-pricing-active
plan: 01
type: execute
subsystem: inventory
tags: [prisma, schema, migration, warehouse, kg-pricing, stock-location, ui]
requires: []
provides:
  - Prisma schema with TransferStatus, CountStatus, WAREHOUSE_TRANSFER, PHYSICAL_COUNT_ADJUSTMENT, pricePerKg, locationId on StockLedgerEntry, WarehouseTransfer, WarehouseTransferLine, PhysicalCount, PhysicalCountLine models
  - Location-aware stock ledger create and balanceAfter scoping
  - Location-scoped stock availability queries (getFilledStockByItem, assertFilledStockAvailable)
  - WarehouseSelector reusable React component
affects: [inventory, configuration, ui]
tech-stack:
  added: []
  patterns: [location-scoped stock queries, per-location balanceAfter calculation]
key-files:
  created:
    - prisma/schema.prisma (modified — 1350+ lines, added ~135 lines of schema)
    - prisma/migrations/20260625130312_add_warehouse_location_kg_pricing/migration.sql
    - src/components/WarehouseSelector.tsx (new — 83 lines)
  modified:
    - src/server/services/inventory/stock-ledger.ts (locationId support)
    - src/server/services/inventory/stock-availability.ts (locationId support)
decisions:
  - "All Phase 6 schema changes are additive — no breaking changes to existing models"
  - "locationId is nullable on StockLedgerEntry to maintain backward compatibility with existing records"
  - "No Prisma relations from Company/User/FinancialYear to new models — scalar FKs only (same pattern as BulkStockLedgerEntry)"
  - "Existing compound index on [companyId, itemId, cylinderState, transactionDate] kept; new compound index with locationId is additional"
  - "StockLocation CRUD already existed under fleet-master.ts — no new API endpoint needed"
  - "WarehouseSelector fetches type=WAREHOUSE only from existing GET /api/configuration/stock-locations"
  - "Pre-existing working tree changes stashed between tasks for clean atomic commits; unstashed after SUMMARY commit"
metrics:
  duration: 11m
  completed: 2026-06-25T18:12:00Z
  tasks_planned: 3
  tasks_completed: 3
  tests_passing: 322
  commits: 3
status: complete
---

# Phase 06 Plan 01: Warehouse & Location Schema, Stock Services, WarehouseSelector

**Objective:** Deliver all Prisma schema changes for Phase 6 in one additive migration, update stock ledger and stock availability services for location-scoped queries, and provide a reusable WarehouseSelector UI component.

**Outcome:** Built the schema and service foundation that Plans 2, 3, and 4 depend on. Every feature in Phase 6 uses `locationId` on `StockLedgerEntry` or `pricePerKg` on `ItemPrice`. The new models (WarehouseTransfer, PhysicalCount) are defined so subsequent plans only need to implement services against them.

## Tasks Executed

| Task | Name | Commit | Key Files |
| ---- | ---- | ------ | --------- |
| 1 | Prisma schema changes — all Phase 6 additions in one migration | `3778ae1` | `prisma/schema.prisma`, `prisma/migrations/20260625130312_add_warehouse_location_kg_pricing/` |
| 2 | Update stock-ledger.ts and stock-availability.ts for location awareness | `ce35a1d` | `src/server/services/inventory/stock-ledger.ts`, `src/server/services/inventory/stock-availability.ts` |
| 3 | StockLocation CRUD API and WarehouseSelector UI component | `fd9867d` | `src/components/WarehouseSelector.tsx` |

### Task 1: Prisma schema changes

**Changes applied to `prisma/schema.prisma` (additive only):**

- **New enums:** `TransferStatus` (DRAFT, COMPLETED, CANCELLED), `CountStatus` (DRAFT, IN_PROGRESS, APPROVED, CANCELLED)
- **StockSourceType:** Appended `WAREHOUSE_TRANSFER` and `PHYSICAL_COUNT_ADJUSTMENT` as last two values
- **ItemPrice model:** Added `pricePerKg Decimal? @db.Decimal(14, 4)` after `price`
- **StockLedgerEntry model:**
  - Added `locationId String?` after `vendorId`
  - Added `location StockLocation? @relation(fields: [locationId], references: [id])` after vendor relation
  - Added `@@index([companyId, itemId, cylinderState, locationId, transactionDate])` as additional compound index
- **New models:** `WarehouseTransfer`, `WarehouseTransferLine`, `PhysicalCount`, `PhysicalCountLine` — all with scalar FKs (no Prisma relations to Company/User/FinancialYear)
- Migration: `prisma migrate dev` created `20260625130312_add_warehouse_location_kg_pricing` and applied successfully to both dev and test databases
- Verification: `npx prisma generate` and `npx tsc --noEmit` pass with zero errors

### Task 2: Location-aware stock services

**`stock-ledger.ts`:**
- Added `locationId?: string` to `StockLedgerInput` type
- `createStockLedgerEntry`: `findFirst` where clause now includes `locationId: input.locationId ?? null` — scopes `balanceAfter` per (companyId, itemId, cylinderState, locationId) when provided, falls back to legacy null-scoped global balance when omitted
- Create data object includes `locationId: input.locationId ?? null`

**`stock-availability.ts`:**
- Added `locationId?: string` to both `getFilledStockByItem` and `assertFilledStockAvailable` input types
- `groupBy` where clause adds `locationId: input.locationId` — `undefined` means no filter (matches all), specific string filters to that location
- `assertFilledStockAvailable` passes `locationId` through to `getFilledStockByItem`

Both changes are fully backward compatible — existing callers that don't pass locationId continue working identically.

### Task 3: WarehouseSelector component

- **StockLocation CRUD:** Already existed under `src/server/services/master-data/fleet-master.ts` — the GET `/api/configuration/stock-locations?type=WAREHOUSE` endpoint already works as expected. No new API created.
- **`src/components/WarehouseSelector.tsx`:** New 83-line reusable client component
  - Props: `{ value: string; onChange: (locationId: string) => void; companyId: string; disabled?: boolean; className?: string }`
  - Fetches from `/api/configuration/stock-locations?type=WAREHOUSE` on mount
  - Renders `<select>` with "Select Warehouse..." placeholder
  - Each option: `[code] name` format
  - Handles loading/error/empty states
  - Follows existing form select styling conventions (Tailwind CSS)
- **Navigation:** `Stock Locations` tab already existed in `configurationFleet` array — no duplicate added

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. All three tasks completed without deviation.

## Threat Surface Scan

No new threat surface introduced beyond what the plan's `<threat_model>` covers. StockLocation CRUD already existed under fleet-master.ts with company-scoped queries. New locationId field on StockLedgerEntry and WarehouseSelector component don't expose cross-tenant data paths.

## Known Stubs

None. WarehouseSelector is a fully wired component that fetches live data from the existing API. The StockLocation CRUD endpoints are already fully functional.

## Self-Check

- [x] `prisma/schema.prisma` modified — exists at 1350+ lines
- [x] Migration file exists at `prisma/migrations/20260625130312_add_warehouse_location_kg_pricing/`
- [x] Commit `3778ae1` exists
- [x] Commit `ce35a1d` exists
- [x] Commit `fd9867d` exists
- [x] `npx prisma generate` passes
- [x] `npx tsc --noEmit` passes with zero errors
- [x] All 322 existing tests pass

## Self-Check: PASSED
