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
- Production bootstrap uses `prisma/seed-production.js` with `SEED_ADMIN_PASSWORD` (required).
  Local/test seed remains `prisma/seed.js`. Start embedded PG:
  `pg_ctl -D .local-postgres -o "-p 5432" start`.

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
  Import / Plant / Dollar tab definitions remain centralized in `PENDING_NAV`; the
  Import module is now exposed because its first contract workflow exists.

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

## Phases 3–7 — IN PROGRESS
- 3: Import contracts (Taftan/Ship) + Loading/Shipments + Purchase/Sale contracts.
  **Started:** Import Contract CRUD is live in the local solution:
  `src/server/services/import/import-contracts.ts`, API routes under
  `src/app/api/import/import-contracts/`, and the protected page under
  `src/app/(protected)/import/import-contracts/`. It validates vendor and bulk
  product references, generates IMC numbers, derives USD/PKR totals, enforces
  closed-day/RBAC/audit rules, and intentionally does not post stock until loading.
  Regression coverage is in `tests/import-contracts.test.mjs`.
  **Loading/Shipment Receiving added:** `src/server/services/import/loadings.ts`,
  API routes under `src/app/api/import/loadings/`, and the protected Loading and
  Shipments pages now create `LOAD` documents, post in-transit ledger movements,
  support cumulative partial receipts, and move received quantities into stock.
  Coverage is in `tests/loadings.test.mjs`.
  **Purchase Contracts added:** local purchase commitments now have CRUD APIs and
  a protected master-data screen with generated `PUC` numbers, vendor/product
  validation, derived PKR amounts, closed-day protection, RBAC, and audit coverage
  in `tests/purchase-contracts.test.mjs`.
  **Local Purchase added:** local receipts now generate `LP` documents, post
  bulk stock IN, create a balanced bulk-stock/vendor-payable voucher, update
  contract delivered quantity/status, and reject over-delivery. Coverage is in
  `tests/local-purchases.test.mjs`.
  **Sale Contracts added:** bulk sale commitments now have CRUD APIs and a
  protected screen with generated `SLC` numbers, customer/product validation,
  amount calculation, status tracking, RBAC, date protection, and audit coverage
  in `tests/sale-contracts.test.mjs`.
  **Delivered Sale added:** deliveries now generate `DSL` documents, enforce
  available bulk stock, post stock OUT and balanced customer-receivable/sales
  vouchers, update contract delivery status, and expose a protected UI screen.
  Coverage is in `tests/delivered-sales.test.mjs`.
- 4: Local purchase, delivered sale (with/without contract), plant decanting, filling
  sale, plant bulk sale, plant transfer, partial receiving, dollar purchase/sale.
  **Plant Transfer added:** `PT` documents now validate plant/location ownership,
  post paired bulk stock OUT/IN ledger entries, enforce stock availability and
  date/RBAC rules, and expose a protected screen. Coverage is in
  `tests/plant-transfers.test.mjs`.
  **Partial Receiving added:** header/event APIs now generate `PRC` documents,
  accumulate receipt events, enforce remaining quantity, post each receipt to
  plant bulk stock, and transition `IN_TRANSIT` → `ARRIVED` → `RECEIVED`.
  Coverage is in `tests/partial-receiving.test.mjs`.
  **Plant Decanting added:** a dedicated `PlantDecanting` model and migration
  now represent source/in-transit-to-plant-tank movement with `PDC` documents,
  paired DECANTING ledger entries, and plant/vehicle traceability. Coverage is in
  `tests/plant-decanting.test.mjs`.
  **Plant Bulk/Filling Sales added:** PlantSale `BULK` and `FILLING` flows now
  generate `PBS`/`FS` documents, validate plant-owned locations, post bulk stock
  OUT, create balanced customer receivable/sales vouchers, and expose protected
  UI screens. Coverage is in `tests/plant-sales.test.mjs`.
- 5: Dollar ledger, exchange gain/loss, voucher print, P&L posting for loss/gain.
  **Dollar Purchase/Sale added:** shared dollar transaction APIs now derive PKR
  from USD and exchange rate, generate `DP`/`DSALE` documents, validate parties,
  post stock IN/OUT and balanced vouchers, and expose the Dollar Transactions UI.
  Coverage is in `tests/dollar-transactions.test.mjs`.
  **Dollar Settlements added:** `DPAY`/`DREC` Payment and Receipt workflows now
  settle vendor/customer balances against a counter account, calculate exchange
  gain/loss from reference versus settlement rates, and post balanced vouchers.
  Coverage is in `tests/dollar-settlements.test.mjs`.
  **Dollar Ledger report added:** filtered JSON and CSV reporting now covers
  Dollar purchases, sales, payments, receipts, exchange rates, and gain/loss.
  Coverage is in `tests/dollar-reports.test.mjs`.
  **Bulk reports added:** Bulk Stock Ledger and All Contract Summary now expose
  movement balances, transit/source details, and combined import/purchase/sale
  commitments. Coverage is in `tests/bulk-reports.test.mjs`.
  **Import reports expanded:** Taftan Contract Summary, In-Transit Report, and
  Loading Report now reconcile contract quantity, loaded quantity, arrived
  quantity, remaining quantity, and shipment status.
  **Dollar report variants added:** Delivered Sale (Dollar) and Plant Bulk Sale
  (Dollar) now have separate filtered report routes and protected screens.
-  **Opening Voucher added:** the configuration workflow now posts balanced `OPV`
   accounting vouchers with account validation, date/RBAC guards, audit logging,
   and a protected entry/list screen. Coverage is in
   `tests/opening-vouchers.test.mjs`.
-  **Printable documents expanded:** voucher-backed bulk, plant, dollar, settlement,
   and opening-voucher rows now expose a shared protected print view with voucher
   lines and bulk stock lines where applicable. Coverage is in
   `tests/transaction-documents.test.mjs`.
   The same API resolves non-voucher Loading, Plant Transfer, Plant Decanting, and
   Partial Receiving documents from bulk-ledger sources, preserving paired movement
   lines while reporting physical quantity once.
-  **Map Area enforcement expanded:** assigned-area restrictions now apply to customer/vendor
   lookup queries (including `all=1`), core sale/purchase/payment party validation, import
   contract workflows, and customer-facing operational report rows. Users without mappings
   remain unrestricted for backward compatibility.
- 6: Dashboard widgets and remaining report refinements.
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
