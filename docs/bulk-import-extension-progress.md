# Bulk / Import / Dollar / Plant Extension — Build Progress

Tracks the multi-phase build that adds the bulk LPG import-trading domain on top
of the existing cylinder-distribution ERP. Started 2026-06-12.

## Locked decisions
- **Separate `BulkStockLedgerEntry`** for bulk inventory (decimal qty, plant/location,
  in-transit). The cylinder `StockLedgerEntry` is untouched.
- **Same company / unified GL.** Bulk stock, dollar gain/loss, plant sales post into
  the same ChartAccount / AccountingVoucher engine.
- **Build autonomously through all phases**, checkpoint at phase boundaries.
- New tables use scalar FK ids (no Prisma relations to core models); relations exist
  only among new models (parent→child). Integrity enforced in the service layer.

## Environment gotcha (important)
- The app runs against a **Neon cloud Postgres** via `.env.local` (`DATABASE_URL` +
  `DATABASE_URL_UNPOOLED`).
- **Prisma CLI and tests** use the **local embedded Postgres** via `.env`
  (`postgresql://lpg:...@localhost:5432/lpg_management_system`).
- Migrations must be applied to BOTH. Apply to Neon with:
  `DATABASE_URL=<unpooled> npx prisma migrate deploy`
- Seed the new permissions/accounts to any target with the idempotent, target-agnostic
  script (NOT the fixed-id seed): `DATABASE_URL=<url> node prisma/extend-bulk.js`
- Neon's company id happens to be `seed-company-lpg-management-system`. Admin login is
  `admin` / `4784Shani`. Start embedded PG: `pg_ctl -D .local-postgres -o "-p 5432" start`.

## Phase 1 — Foundation ✅ DONE (live on Neon + local)
- `prisma/schema.prisma`: 21 new models + 11 enums (migration
  `20260612063831_bulk_import_dollar_plant_extension`).
- Models: Transporter, Driver, Vehicle, Plant, StockLocation, BulkProduct,
  BulkStockLedgerEntry, BulkOpeningStock, ImportContract, Loading, PurchaseContract,
  LocalPurchase, SaleContract, SaleDelivery, LossGain, DollarTransaction, PlantSale,
  PlantTransfer, PartialReceiving, PartialReceivingEvent.
- Permissions: 21 new modules × 6 actions (`prisma/extend-bulk.js`, also added to
  `prisma/seed.js`).
- Control accounts: Bulk LPG Stock `2003002001`, Bulk Stock In Transit `2003003001`,
  Bulk LPG Sales `3001002001`, Inventory Gain `3001003001`, Exchange Gain `3002001001`,
  Freight `4001003001`, Inventory Loss `4001004001`, Exchange Loss `4002001001`.
  Codes registered in `src/server/services/accounting/accounts.ts` (`ACCOUNT_CODES`).
- Document prefixes added in `accounting/document-numbers.ts` (IMC, LOAD, PUC, SLC, LP,
  DSL, PDC, FS, PBS, PT, PRC, LG, DP, DSALE, OPV).
- Navigation (`src/lib/navigation/modules.ts`): "Fleet & Plants" master group live.
  Import / Plant / Dollar modules + import/dollar report groups are DEFINED but gated
  out of `NAV_MODULES` (exported as `PENDING_NAV`) until their pages exist — re-attach
  is a one-line change per module. Sidebar icons/themes added for import/plant/dollar.

## Phase 2 — Master data ⏳ IN PROGRESS
DONE (service + API + page + RBAC + audit, smoke-tested on Neon):
- Transporters, Drivers, Vehicles, Plants, Stock Locations, Bulk Products
  (`src/server/services/master-data/fleet-master.ts`,
  `src/app/api/configuration/<name>/{route,[id]/route}.ts`,
  `src/app/(protected)/configuration/<name>/page.tsx`).
- **Bulk stock-ledger engine**: `src/server/services/inventory/bulk-stock-ledger.ts`
  (`createBulkStockLedgerEntry`, `getBulkOnHand`) — decimal qty, location + in-transit
  running balance, negative-stock guard via company `stockAvailableCheck`.
- **Bulk Opening Stock**: `src/server/services/opening-balances/bulk-opening-stock.ts`
  (records + posts OPENING_STOCK / ADJUSTMENT ledger entries; lock guard).

REMAINING:
- Opening Voucher screen/service (gated nav tab). Opening Stock = inventory only;
  Opening Voucher should post the GL opening balances (cash/bank/customer/vendor/asset/
  liability + bulk stock value) as a balanced `OPENING` voucher.

## Phases 3–7 — NOT STARTED
- 3: Import contracts (Taftan/Ship) + Loading/Shipments + Purchase/Sale contracts.
- 4: Local purchase, delivered sale (with/without contract), plant decanting, filling
  sale, plant bulk sale, plant transfer, partial receiving, dollar purchase/sale.
- 5: Dollar ledger, exchange gain/loss, voucher print, P&L posting for loss/gain.
- 6: Import/contract/dollar/in-transit reports, contract summaries, dashboard widgets.
- 7: QA, smoke tests, role checks, final checklist.

## Reusable patterns to follow
- Transactional service template: `src/server/services/purchases/purchase-filled-cylinder.ts`
  (`$transaction` → `enforcePermission` → `assertWritableBusinessDate` → stock ledger →
  `createBalancedVoucher` → `writeAuditLog` → `nextDocumentNumberInTransaction`).
- Master CRUD UI: `MasterDataManager` (declarative fields/columns, optionSource selects).
- Report UI: `ReportTableClient`. Multi-line form: `OperationForm`.

## Verification done
- `npx tsc --noEmit` clean. `next build` passes with all new routes.
- Neon smoke test: created Transporter/Plant/StockLocation/BulkProduct + 150.5 MT bulk
  opening stock (ledger entry posted). RBAC enforced (CREATE permission required).
- NOTE: a few demo rows (TR01 "Quetta Carriers", PLANT1, LOC1, LPG product, opening
  stock) were created on Neon during smoke-testing; delete if unwanted.
