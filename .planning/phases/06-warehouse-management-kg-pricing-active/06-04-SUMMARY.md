---
phase: 06-warehouse-management-kg-pricing-active
plan: 06-04
subsystem: warehouse
tags:
  - physical-count
  - stock-by-location
  - inventory
  - reports
  - navigation
requires: [06-03]
provides: [physical-inventory-counts, stock-by-location-report]
affects: [inventory-api, reports-api, navigation]
tech-stack:
  added: [physical-count, stock-by-location]
  patterns: [physical-count-form-lines-approve, stock-by-location-grouped-table]
key-files:
  created:
    - src/server/services/warehouse/physical-count.ts
    - src/app/api/inventory/physical-counts/route.ts
    - src/app/api/inventory/physical-counts/[id]/route.ts
    - src/app/api/inventory/physical-counts/[id]/lines/route.ts
    - src/app/api/inventory/physical-counts/[id]/approve/route.ts
    - src/server/services/reports/stock-by-location.ts
    - src/app/api/reports/stock-by-location/route.ts
    - src/components/StockByLocationTable.tsx
    - src/app/(protected)/reports/stock-by-location/page.tsx
    - src/components/PhysicalCountForm.tsx
    - src/components/PhysicalCountList.tsx
    - src/app/(protected)/operations/physical-count/page.tsx
  modified:
    - src/server/services/accounting/document-numbers.ts
    - src/lib/navigation/modules.ts
decisions:
  - Physical count uses PC- prefix for document numbers via document-numbers service
  - Route paths use 6-level parent traversal for nested `[id]/lines` and `[id]/approve` routes, 5-level for top-level physical-counts route, and 4-level for stock-by-location report route (one-level shallower under `api/reports` vs `api/inventory/physical-counts`)
  - addPhysicalCountLines accepts userId as input parameter (deviation: plan omitted userId, required for audit trail)
metrics:
  duration: 1h 17m
  completed: 2026-06-25
  tasks: 3
status: complete
---

# Phase 06 Plan 04: Physical Inventory Counts & Stock by Location Report

## One-liner

Physical inventory count CRUD with variance-based adjustment posting in a single DB transaction, a stock-by-location report aggregating the stock ledger by location+item+cylinderState, and full UI components with navigation wiring.

## Tasks Completed

### Task 1: Physical Count Service & API Routes

- **Created** `src/server/services/warehouse/physical-count.ts` with 5 exported functions:
  - `createPhysicalCount` — creates count header with sequential PC- prefix document number, enforces no concurrent open draft for same location
  - `getPhysicalCountById` — returns count with lines and item details
  - `listPhysicalCounts` — paginated list with search by document number
  - `addPhysicalCountLines` — bulk upsert count lines with unit-price override support
  - `approvePhysicalCount` — single-transaction variance calculation + stock ledger adjustment posting + status update
- **Created** 5 API route files following `src/app/api/inventory/physical-counts/` tree:
  - `route.ts` — POST (create) and GET (list)
  - `[id]/route.ts` — GET by ID
  - `[id]/lines/route.ts` — POST lines
  - `[id]/approve/route.ts` — POST approve
- **Modified** `src/server/services/accounting/document-numbers.ts` — added `physicalCount: "PC"` prefix

### Task 2: Stock-by-Location Report

- **Created** `src/server/services/reports/stock-by-location.ts` — groups stock ledger by `(locationId, itemId, cylinderState)` with optional location filter, returning total quantity and total value per group
- **Created** `src/app/api/reports/stock-by-location/route.ts` — GET endpoint with optional `?locationId=` search param
- **Created** `src/components/StockByLocationTable.tsx` — location-grouped collapsible table with location filter dropdown, follows DataTable pattern
- **Created** `src/app/(protected)/reports/stock-by-location/page.tsx` — page route with client wrapper
- **Modified** `src/lib/navigation/modules.ts` — added "Stock by Location" tab under Reports > Stock group

### Task 3: Physical Count UI Components

- **Created** `src/components/PhysicalCountForm.tsx` — 3-mode form (Create header → Add lines → Approved state):
  - Create mode: WarehouseSelector, date picker, notes
  - Lines mode: dynamic table with item dropdown, cylinder state selector, quantity, remarks, add/remove lines
  - Approve button with confirmation dialog, posts adjustment entries
- **Created** `src/components/PhysicalCountList.tsx` — list table with drill-down to detail view (count lines with variance display), approve button in detail view
- **Created** `src/app/(protected)/operations/physical-count/page.tsx` — composes form + list with refresh on success
- **Modified** `src/lib/navigation/modules.ts` — added "Physical Count" tab under Sale/Purchase module with match prefix

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| TypeScript compiles clean (`npx tsc --noEmit`) | ✅ PASS |
| Physical-count route prefix: 5 levels for top-level, 6 for nested `[id]/` | ✅ PASS (verified via Resolve-Path) |
| Stock-by-location route prefix: 4 levels | ✅ PASS (verified via Resolve-Path) |
| POST/GET API routes follow existing pattern | ✅ PASS (mirrors warehouse-transfer) |
| Navigation match prefixes wired | ✅ PASS (Sale/Purchase module includes `/operations/physical-count`) |
| Report tab in Reports > Stock group | ✅ PASS ("Stock by Location" added to reportsStock array) |
| PhysicalCountForm has create/lines/approve modes | ✅ PASS |
| StockByLocationTable groups by location | ✅ PASS (location-grouped collapsible sections) |

**Runtime acceptance criteria** (API endpoint behavior) require a running server — verified at the code/type level only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical Functionality] Added `userId` parameter to `addPhysicalCountLines`**
- **Found during:** Task 1
- **Issue:** Plan omitted `userId` from `addPhysicalCountLines` signature, but stock ledger adjustments require an audit trail user
- **Fix:** Added `userId: string` to function parameters, passed through to systemFields and stock ledger entry
- **Files modified:** `src/server/services/warehouse/physical-count.ts`
- **Commit:** `8c3bbdf`

### Auth Gates

None encountered — all operations use server-side DB access with existing auth middleware.

### Deferred Items

None.

## Threat Flags

No new security-relevant surface identified beyond what the plan's threat model described.

## TDD Gate Compliance

Plan type is `auto` (not `tdd`) — no TDD gate required.

## Self-Check: PASSED

- [x] `src/server/services/warehouse/physical-count.ts` exists
- [x] `src/app/api/inventory/physical-counts/route.ts` exists
- [x] `src/app/api/inventory/physical-counts/[id]/route.ts` exists
- [x] `src/app/api/inventory/physical-counts/[id]/lines/route.ts` exists
- [x] `src/app/api/inventory/physical-counts/[id]/approve/route.ts` exists
- [x] `src/server/services/reports/stock-by-location.ts` exists
- [x] `src/app/api/reports/stock-by-location/route.ts` exists
- [x] `src/components/StockByLocationTable.tsx` exists
- [x] `src/components/PhysicalCountForm.tsx` exists
- [x] `src/components/PhysicalCountList.tsx` exists
- [x] `src/app/(protected)/operations/physical-count/page.tsx` exists
- [x] `src/app/(protected)/reports/stock-by-location/page.tsx` exists
- [x] Commit `8c3bbdf` exists
- [x] Commit `41cceb9` exists
- [x] Commit `fb62304` exists
- [x] `npx tsc --noEmit` passes
