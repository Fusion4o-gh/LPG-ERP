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

---

## P1 — Masters & configuration

| Item | Status | Notes |
|------|--------|-------|
| Customer field parity | Done | Contact, tax, city/area, credit days |
| Vendor field parity | Done | |
| Bank Coding under Configuration | Done | |
| Company settings → transactions | Partial | stock check on sale; default date (sprint) |
| Item brand/category on form | Open | Schema exists |
| Vendor brand mapping | Open | Not modeled |
| Map area enforcement in lookups | Open | Stored, not filtered |
| Expense type opening balance | Open | |
| Change password | Done | `/configuration/change-password` |

---

## P2 — Dashboard & shell

| Item | Status | Notes |
|------|--------|-------|
| KPI tiles | Done | |
| Quick links | Done | |
| Bank position → GL drill-down | Partial | Links (sprint) |
| Collapsible stock / sale panels | Partial | (sprint) |
| Stale backup warning | Partial | (sprint) |
| Global search | Open | Placeholder only |
| Urdu UI / invoice print | Open | Selector only |
| Voucher list in sidebar | Open | Page exists |
| Voucher # preview on payments | Partial | Sale/purchase previews exist; standalone payments need preview |

---

## P3 — Reports

| Item | Status | Notes |
|------|--------|-------|
| Sale B/W Date | Done | Invoice / item / type modes |
| Access Cylinders (own business) | Open | Second variant |
| Profit & Loss statement layout | Done | Revenue/expense sections, monthly columns, print |
| Remaining reports | Partial | Validate totals vs legacy data |

---

## P4 — Accounting depth

| Item | Status | Notes |
|------|--------|-------|
| Chart of accounts tree UI | Open | Flat CRUD |
| Day close reconciliation report | Open | Basic close/reopen |
| Database restore / schedule | Open | Manual backup only |

---

## Suggested build order (ongoing)

1. Run a P0 verification sprint over every completed operator workflow: Sale LPG, all purchase flows, Empty Sale, Complete Day Sale, Cylinder Return, Security Receipt, Sale B/W Date, Daily Activity, Chart of Account, and Group Summary.
2. Add regression coverage for settlement posting: cash, bank, credit, partial settlement, discount, cheque metadata, gas return, vendor payment, and refund cases.
3. Finish P1 configuration wiring: company default-date/redirect/working-day behavior, item brand/category UI, map-area lookup enforcement, expense type opening balances, and company logo upload.
4. Finish P2 shell/dashboard gaps: bank drill-down, collapsible dashboard sections, stale backup warning, global search, voucher list in sidebar, and voucher previews for standalone payment/receipt screens.
5. Finish P3/P4 depth: Access Cylinders own-business report, report total validation against legacy audit samples, chart-of-accounts tree UI, day-close reconciliation, and database restore/schedule.

---

**Last updated:** 2026-05-30
