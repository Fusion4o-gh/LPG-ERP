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
| Voucher # preview on payments | Open | |

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

1. P0 settlement on remaining transaction forms (shared service helpers).
2. P0 sale B/W modes + security receipt.
3. P1 company settings + item brand/category + map area filters.
4. P2 shell (search, voucher history, payment previews).
5. P3 report polish + P4 accounting tree.

---

**Last updated:** 2026-05-28
