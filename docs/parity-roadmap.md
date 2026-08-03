# Original ERP Parity Roadmap

Living tracker for matching [Hasnan Traders legacy ERP](https://hasnantraders.evtsolutionz.com) behavior.  
Reference: `docs/original-module-study-build-plan.md`, `docs/original-live-audit.json`, `docs/uat-legacy-parity-checklist.md`.

**Definition of done (per module):** route in sidebar, original fields or documented omission, atomic posting, list/history, print where legacy had print, reports reconcile from ledgers, RBAC + closed-day guards.

---

## Status legend

| Status | Meaning |
|--------|---------|
| Done | Matches legacy for normal operator use |
| Partial | Screen exists; fields, reports, or UX differ |
| Open | Not started or backend-only |
| N/A | Legacy unused; clone has equivalent |
| Improved | Intentionally better than legacy |

---

## Current milestone

The original audit's operator-critical parity work is now implemented for normal data entry flows. The next milestone is not more first-pass cloning; it is verification, accounting hardening, and the remaining configuration/report depth that makes the clone reliable without reopening the legacy site.

---

## P0 — Operator-critical

| Item | Status | Notes |
|------|--------|-------|
| Financial year on login + switch in shell | Done | Login FY dropdown + topbar switcher |
| Settlement on Sale LPG | Done | Discount, receipt, gas return, balance/stock |
| Settlement on Purchase Filled | Done | Payment variant, vendor balance |
| Settlement on Purchase Empty/Other | Done | `SettlementPanel` + vendor payment |
| Settlement on Empty Sale | Done | Customer receipt settlement |
| Settlement on Cylinder Return | Done | Refund settlement when total > 0 |
| Settlement on Complete Day Sale | Done | Per-row Cash/Bank/Credit + bank/cheque |
| Security Receipt qty / stock / cheque | Done | `SecurityReceiptForm` + backend qty/mode |
| Cash/bank balance on settlement | Done | Balance API + panel preview |
| Sale B/W Date modes (item/amount/type) | Done | Invoice / item / type modes + CSV |
| Daily Activity full layout | Done | Sectional client |
| Chart Of Account report | Done | |
| Group Summary report | Done | |
| Unbalance Voucher report | Improved | Live-reference Account Reports menu parity; posted debit/credit differences are filterable, printable, and exportable before day close |
| Debtors / Creditors Ageing reports | Improved | Live-reference Account Reports parity; posted party balances are FIFO-allocated and aged by customer/vendor credit days with printable and CSV output |
| Closing Stock Summary | Improved | Live-reference Inventory Reports parity; period opening, received, issued, and closing cylinder quantities reconcile by item, state, and location |
| Consumption Report | Improved | Live-reference Inventory Reports parity; non-transit bulk stock issues are grouped by product, location, source, and quantity |
| Quantitative Reconciliation | Improved | Live-reference Inventory Reports parity; non-transit bulk opening + receipts − issues = physical closing, with transit quantity visible separately |
| CMR Difference Report | Improved | Live-reference Import Inventory parity; loaded quantity is reconciled with recorded CMR/arrival quantity per loading |
| Import Cost Sheet | Improved | Live-reference Import Inventory parity; rate, freight, final landed rate, loaded/arrived quantities, and calculated cost are shown per loading |
| Retail Sale Register | Improved | Live-reference Inventory Reports parity; delivered/filling sales include customer, product, vehicle, weight, rate, and amount details |
| Stock Transit Reconcile | Improved | Live-reference Inventory Reports parity; in-transit ledger balances reconcile against outstanding loading documents |
| Transport & Bowser Wise Report | Improved | Live-reference Inventory Reports parity; vehicle trips, capacity, transporter, quantity, and amount are summarized |
| Stock Adjustment Report | Improved | Live-reference Inventory Reports parity; loss/gain quantities, financial impact, approval, and P&L posting status are visible |
| Plant Decant Report | Improved | Live-reference Plant/Inventory parity; source-to-destination decant movements include plant, product, transport, quantity, and amount |
| Partial Sale Status Report | Improved | Live-reference Partial Receiving/Sale parity; total, received, remaining, arrival, and sale status are visible |
| Local Purchase Detail/Summary | Improved | Live-reference Local Purchase Inventory parity; detail rows and vendor/product totals reconcile from local purchase records |
| Contract Purchase Sale Report | Improved | Live-reference Inventory Reports parity; import, local purchase, and sale contracts share a reconciled quantity/amount/status view |

---

## P1 — Masters & configuration

| Item | Status | Notes |
|------|--------|-------|
| Customer field parity | Done | Contact, tax, city/area, credit days |
| Vendor field parity | Done | |
| Bank Coding under Configuration | Done | |
| Company settings → transactions | Improved | Stock check on sale plus persisted default-date, post-save redirect, and working-day settings used by transaction forms |
| Item brand/category on form | Done | Item master form exposes category and brand selectors |
| Item Define Prices action | Improved | Item rows expose item-specific default/customer price history, effective dates, sale price, optional per-kg pricing, item permission checks, and ItemPrice audit records |
| Vendor brand mapping | Done | Vendor master supports multi-brand selection with validated `VendorBrand` links |
| Map area enforcement in lookups | Done | Customer/vendor lookups, core party writes, and customer-facing operational reports enforce assigned areas; users without mappings remain unrestricted |
| Expense type opening balance | Improved | Create and edit flows post, update, or clear the linked opening voucher; edits are blocked once that account has accounting movement and all changes are audited |
| Financial-year opening cutover | Improved | Financial Years expose an audited, irreversible lock that blocks opening-balance create, edit, and delete operations after cutover |
| Change password | Done | `/configuration/change-password` |

---

## P2 — Dashboard & shell

| Item | Status | Notes |
|------|--------|-------|
| KPI tiles | Improved | Today KPIs remain current while Sale Stats now supports an operator-selected month/year period, matching the legacy dashboard controls |
| Quick links | Done | |
| Bank position → GL drill-down | Done | Dashboard bank rows link to the filtered general ledger |
| Collapsible stock / sale panels | Done | Dashboard stock, bulk stock, in-transit, bank, and sale sections are collapsible |
| Stale backup warning | Done | Dashboard exposes first-backup and stale-backup state from local backup timestamps |
| Global search | Improved | Protected search across customers, vendors, items, bulk products, vouchers, and supported operational documents; party results honor Map Area |
| Urdu UI / invoice print | Improved | Global UI language plus English/Urdu selector on every shared transaction print view; configured company name, logo, address, contact, NTN, and GST now flow into printable transaction headers; exact legacy typography/layout remains to validate |
| Voucher list in sidebar | Done | Payment navigation includes protected voucher list/detail routes |
| Voucher # preview on payments | Done | Standalone cash/bank payment and receipt forms call the non-allocating next-number API and refresh after posting |

---

## P3 — Reports

| Item | Status | Notes |
|------|--------|-------|
| Sale B/W Date | Done | Invoice / item / type modes |
| Access Cylinders (own business) | Done | Report client includes own-business stock variant |
| Profit & Loss statement layout | Done | Revenue/expense sections, monthly columns, print |
| Remaining reports | Partial | Accounting variants now include Transactions Listing, Multiple Ledger, Combine Ledger, and Executive Summary; voucher list, stock ledger, audit log, stock-by-location, plus six contract/loading/dollar report variants now expose CSV/print output; validate totals vs legacy data |

---

## P4 — Accounting depth

| Item | Status | Notes |
|------|--------|-------|
| Chart of accounts tree UI | Improved | Hierarchical tree view plus CRUD manager with captured reference account metadata; Opening Voucher remains the accounting source of truth |
| Day close reconciliation report | Done | Preview and close-time guard cover posted vouchers, stock movement totals, cash movement, and bank movement |
| Database restore / schedule | Done | Guarded restore, persisted daily/weekly schedule, retention cleanup, due-run API, and Windows/cron runner script |
| Legacy data migration gate | Partial | Read-only MySQL dump inspector and reconciliation contract are implemented; `Db_backup_2` is HTML and the recovered `mydb_(09-15-31_2026-07-07).zip` contains an encoded/encrypted payload, so write-enabled import remains blocked until it is decrypted and its table/column mapping is reviewed |

---

## Suggested build order (ongoing)

1. Run a P0 verification sprint over every completed operator workflow: Sale LPG, all purchase flows, Empty Sale, Complete Day Sale, Cylinder Return, Security Receipt, Sale B/W Date, Daily Activity, Chart of Account, and Group Summary.
2. Add regression coverage for settlement posting: cash, bank, credit, partial settlement, discount, cheque metadata, gas return, vendor payment, and refund cases.
3. Finish P1 configuration depth: validate company default-date/redirect/working-day behavior against legacy samples and complete any remaining reference-data differences.
4. Finish remaining P2 shell gaps: voucher list in sidebar and voucher previews for standalone payment/receipt screens.
5. Finish P3/P4 depth: report total validation against legacy audit samples, chart-of-accounts tree UI, day-close reconciliation, and database restore/schedule.

---

**Last updated:** 2026-08-03

Latest verification: the full automated suite passes 457/457 tests; focused bulk/dollar report coverage passes 6/6, stock-by-location reconciliation/CSV coverage passes 1/1, UI parity coverage passes 29/29, the branded transaction-document suite passes 8/8, dashboard suite passes 11/11, stock-by-location, audit-log, and voucher-list routes return HTTP 200 live, TypeScript passes, and the production build completes successfully with 321 generated pages. Stock-by-location, audit-log, voucher-list, and six contract/loading/dollar report variants now have service-backed CSV/print output. Historical data import remains explicitly deferred; exact reference-data totals and legacy print-layout comparison remain future validation work.
