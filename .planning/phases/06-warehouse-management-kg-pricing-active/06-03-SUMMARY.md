---
phase: 06-warehouse-management-kg-pricing-active
plan: 03
subsystem: pricing
tags: [kg-pricing, location, warehouse, sale, purchase, ui]
requires:
  - phase: 06-01
    provides: schema changes (pricePerKg, locationId), location-aware stock services, WarehouseSelector
provides:
  - KG pricing service (resolveItemPrice) for auto-calculating cylinder prices from pricePerKg × cylinderWeightKg
  - Price-per-KG management API (PATCH /api/items/[id]/price) with cylinderWeightKg validation
  - Sale LPG service with optional locationId for warehouse dispatch tracking
  - Purchase filled-cylinder service with optional locationId for warehouse receipt tracking
  - KG pricing context on sale context endpoint (kgPricing per item)
  - KG pricing context on purchase context endpoint (kgPricing per item)
  - KgPriceField reusable UI component with formula breakdown, Apply button, and Overridden badge
  - SaleLpgForm with dispatch WarehouseSelector and per-line KG price auto-calc
  - PurchaseFilledCylinderForm with receiving WarehouseSelector and per-line KG price auto-calc
affects: [inventory, sales, purchases, ui]

tech-stack:
  added: []
  patterns:
    - KG pricing resolution in context endpoints (client-side suggestion, server trusts submitted price)
    - locationId threaded through stock ledger entries for warehouse-scoped movements

key-files:
  created:
    - src/server/services/pricing/kg-pricing.ts (resolveItemPrice service)
    - src/app/api/items/[id]/price/route.ts (pricePerKg management)
    - src/components/KgPriceField.tsx (KG pricing UI component)
  modified:
    - src/server/services/sales/sale-lpg.ts (locationId on SaleInput, stock ledger calls)
    - src/app/api/sales/lpg/route.ts (locationId extraction)
    - src/server/services/sales/sale-context.ts (kgPricing per item)
    - src/server/services/purchases/purchase-filled-cylinder.ts (locationId on input, stock ledger calls)
    - src/app/api/purchases/filled-cylinder/route.ts (locationId extraction)
    - src/server/services/purchases/purchase-context.ts (kgPricing per item)
    - src/app/api/purchases/filled-cylinder/context/route.ts (itemIds parameter)
    - src/components/SaleLpgForm.tsx (locationId, WarehouseSelector, KgPriceField)
    - src/components/PurchaseFilledCylinderForm.tsx (locationId, WarehouseSelector, KgPriceField)

key-decisions:
  - "KG pricing is resolved on the client side via the context endpoint — the server uses the submitted unitPrice (user can accept the calculated price or override)"
  - "locationId is optional on all sale/purchase types — existing flows continue working without it (backward compatible)"
  - "Price-per-KG validation requires cylinderWeightKg on the Item — enforced in the PATCH API handler"

patterns-established:
  - "KG Pricing: pricePerKg on ItemPrice, resolved via resolveItemPrice in context endpoints, displayed via KgPriceField in forms"

requirements-completed: [WH-04, PR-02, PR-03]

duration: 18min
completed: 2026-06-25
status: complete
---

# Phase 06 Plan 03: KG Pricing Service + Location-Aware Sale/Purchase Transactions

**KG pricing service (resolveItemPrice) with pricePerKg management API, locationId support in sale/purchase services, KG context endpoints, and UI integrations for warehouse dispatch/receipt with auto-calculated KG pricing.**

## Performance

- **Duration:** 18min
- **Started:** 2026-06-25T18:21:00Z
- **Completed:** 2026-06-25T18:39:00Z
- **Tasks:** 4
- **Files modified:** 13

## Accomplishments

- **KG pricing service** (`resolveItemPrice`): queries applicable ItemPrice, calculates `pricePerKg × cylinderWeightKg` with 2-decimal rounding, falls back to fixed price when KG data incomplete
- **Price-per-KG API** (PATCH `/api/items/[id]/price`): manages ItemPrice records with cylinderWeightKg validation (PR-01-AC5)
- **Sale LPG location support**: `locationId` threaded through `SaleInput` → `assertFilledStockAvailable` → `createStockLedgerEntry` for dispatch warehouse tracking
- **Purchase filled-cylinder location support**: `locationId` threaded through `PurchaseFilledCylinderInput` → `createStockLedgerEntry` for receiving warehouse tracking
- **KG context endpoints**: sale and purchase context endpoints return `kgPricing` per item (unitPrice, pricePerKg, cylinderWeightKg, usingKgPricing)
- **KgPriceField UI**: inline formula display (`@pricePerKg/kg × weightKg = total`), Apply button to auto-set unit price, Overridden badge when user manually changes price
- **Form updates**: SaleLpgForm with dispatch WarehouseSelector, PurchaseFilledCylinderForm with receiving WarehouseSelector — both with per-line KG auto-calc

## Task Commits

Each task was committed atomically:

1. **Task 1: Create kg-pricing.ts service and pricePerKg management API** - `fe98c20` (feat)
2. **Task 2: Update sale-lpg.ts and its API route with locationId + KG pricing** - `e545149` (feat)
3. **Task 3: Update purchase-filled-cylinder.ts and its API route with locationId + KG pricing** - `afef59c` (feat)
4. **Task 4: UI components — KgPriceField, update SaleLpgForm and PurchaseFilledCylinderForm** - `af18adc` (feat)

**Plan metadata:** *(committed via orchestrator)*

## Files Created/Modified

- `src/server/services/pricing/kg-pricing.ts` — resolveItemPrice: KG calculation or fixed price fallback
- `src/app/api/items/[id]/price/route.ts` — PATCH handler for pricePerKg management with validation
- `src/components/KgPriceField.tsx` — inline KG price display with formula, Apply, Overridden badge
- `src/server/services/sales/sale-lpg.ts` — added locationId to SaleInput, threaded through stock calls
- `src/app/api/sales/lpg/route.ts` — locationId extraction and pass-through
- `src/server/services/sales/sale-context.ts` — returns kgPricing per item from context endpoint
- `src/server/services/purchases/purchase-filled-cylinder.ts` — added locationId to input, threaded through stock calls
- `src/app/api/purchases/filled-cylinder/route.ts` — locationId extraction and pass-through
- `src/server/services/purchases/purchase-context.ts` — returns kgPricing per item from context endpoint
- `src/app/api/purchases/filled-cylinder/context/route.ts` — accepts itemIds for KG pricing resolution
- `src/components/SaleLpgForm.tsx` — added location state, WarehouseSelector, KgPriceField per line
- `src/components/PurchaseFilledCylinderForm.tsx` — added location state, WarehouseSelector, KgPriceField per line

## Decisions Made

- **KG pricing is client-suggested, server-trusted**: The context endpoint suggests the calculated unit price; the service uses whatever unitPrice is submitted by the client (user can accept or override). This keeps the service simple and gives users full control per PR-02-AC2/PR-03-AC2.
- **All locationId fields are optional**: Existing sale/purchase flows that don't pass locationId continue working exactly as before. Stock ledger entries for those flows get `locationId: null` — the existing behavior.
- **TypeScript compilation passes with zero errors** across all modified files.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` covers. All APIs use `getRequestContext` for tenant isolation. The KG context endpoints are read-only and scoped to the authenticated company. LocationId is an optional field with the same trust model as other scalar IDs.

## Known Stubs

None. All KG pricing and location features are fully wired end-to-end.

## Self-Check

- [x] `src/server/services/pricing/kg-pricing.ts` exists — exports `resolveItemPrice`
- [x] `src/app/api/items/[id]/price/route.ts` exists — PATCH handler with cylinderWeightKg validation
- [x] `src/components/KgPriceField.tsx` exists — 40 lines, functional
- [x] `npx tsc --noEmit` — zero errors after each task
- [x] Commit `fe98c20` exists
- [x] Commit `e545149` exists
- [x] Commit `afef59c` exists
- [x] Commit `af18adc` exists

## Self-Check: PASSED
