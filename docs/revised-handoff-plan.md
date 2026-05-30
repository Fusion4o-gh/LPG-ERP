# Revised Handoff Plan - LPG ERP Clone

Last reviewed: 2026-05-30

This plan supersedes the older build-order notes in `docs/original-module-study-build-plan.md` where they still describe P0 settlement/report work as pending. The legacy system has already been audited and captured in `docs/original-live-audit.json`; the clone should now move forward from the local implementation and parity tracker.

## What is already updated

Operator-critical parity is mostly implemented:

- Financial year selection exists on login, and the protected shell has a financial year switcher.
- Configuration now includes Change Password and Bank Coding in the sidebar.
- Bank Coding supports account number, phone, email, address, opening balance, opening balance type, and status.
- Company Information includes GST number plus operational settings for stock checks, pricing behavior, default date behavior, redirect behavior, working hours, and working days.
- Customer and Vendor masters include the legacy contact, city/area, segment, registration, tax, and credit-days fields.
- A shared `SettlementPanel` is used across transaction screens with discount, net bill, cash/bank/credit mode, cheque metadata, and cash/bank balance preview.
- Sale LPG now has settlement, live customer balance, stock preview, gas return, and next issue number preview.
- Purchase Filled, Purchase Empty, and Purchase Other have settlement/payment handling and vendor balance context.
- Empty Sale, Cylinder Return, Complete Day Sale, and Security Receipt now include the core settlement paths.
- Security Receipt captures cylinder quantity, item, cash/bank/credit receipt mode, and cheque details.
- Sale B/W Date supports invoice, item, and type modes with CSV export.
- Daily Activity has a sectioned report layout for sales, purchases, returns, cash vouchers, bank vouchers, and stock summary.
- Chart Of Account and Group Summary reports have routes and sidebar entries.
- Dashboard now has KPI tiles, quick links, bank position, stock, and recent activity panels.

## Remaining gaps by priority

### P0 - Verify and harden completed flows

Do this before adding more breadth. The completed P0 work touches stock, customer/vendor balances, accounting vouchers, cheque fields, discounts, and partial settlement. The next sprint should prove those flows with seeded data and regression tests.

Acceptance checklist:

- Sale LPG posts stock OUT, customer receivable, optional receipt voucher, optional bank metadata, discount, gas return stock movement, and audit log.
- Purchase Filled posts stock IN, vendor payable, optional payment voucher, bank metadata, discount, and audit log.
- Purchase Empty and Purchase Other post the correct stock/accounting lines and payment settlement.
- Empty Sale posts empty stock OUT, customer receivable, GST, optional receipt, and print document.
- Cylinder Return posts empty or filled stock IN, customer balance movement, refund settlement only when applicable, and print document.
- Complete Day Sale creates one issue per customer row and handles cash/bank/credit per row.
- Security Receipt posts quantity, customer cylinder/security impact, cash/bank/credit receipt, cheque metadata, and print document.
- Reports reconcile from ledgers rather than screen-only totals.

### P1 - Finish configuration and master parity

- Wire all company settings into behavior, not just storage: default transaction date, redirect-on-save, working-day/time guardrails, and centralized-pricing behavior.
- Add company logo upload/storage and use it on printable documents.
- Add brand/category fields to the Item master UI; the schema already has `categoryId` and `brandId`.
- Model or intentionally omit Vendor brand mapping. The legacy form has multiple brand fields, so the decision should be explicit.
- Enforce Map Area restrictions in customer/vendor lookups and transaction/report filters.
- Add Expense Type opening balance support if this remains a legacy-required setup path.

### P2 - Shell, dashboard, and operator ergonomics

- Make Bank Position rows drill into the relevant GL/account ledger.
- Finish collapsible dashboard stock/sales panels and persist the operator's preference.
- Surface stale-backup warning based on the latest backup timestamp.
- Implement global search for vouchers, customers, vendors, items, and document numbers.
- Add voucher history/list navigation in the sidebar.
- Add next voucher-number previews on standalone cash/bank payment and receipt forms.
- Complete Urdu UI/print support only if it is required for production use; otherwise document it as a deliberate later phase.

### P3 - Reports and print parity

- Build the Access Cylinders own-business variant.
- Validate remaining report totals against the captured legacy audit samples and seeded scenarios.
- Standardize print headers, filters, company identity, and exported CSV field order across reports.
- Keep report totals ledger-derived and avoid duplicating transaction math in report clients.

### P4 - Accounting and operations depth

- Replace flat chart-of-accounts management with a tree UI that exposes hierarchy, group type, and account metadata.
- Add day-close reconciliation so closing a day proves cash, bank, stock, sales, purchases, and vouchers first.
- Add database restore and scheduled backup controls around the existing manual backup flow.
- Add reversal list/status management so adjusted transactions are discoverable, not only posted.

## Concrete next sprint

1. Build a P0 UAT/regression script from `docs/uat-legacy-parity-checklist.md` and seed enough sample data to exercise cash, bank, credit, discount, gas return, filled/empty cylinder, and partial-payment scenarios.
2. Add focused automated tests around settlement voucher creation and stock ledger side effects for Sale LPG, Purchase Filled, Empty Sale, Cylinder Return, Complete Day Sale, and Security Receipt.
3. Fix any verification failures before starting new UI breadth.
4. Then implement the P1 gaps in this order: item brand/category UI, company settings behavior wiring, map-area lookup enforcement, logo upload, expense type opening balances, and vendor brand mapping decision.

## Notes for the next developer

- Treat `docs/parity-roadmap.md` as the live tracker.
- Treat `docs/original-live-audit.json` as the legacy reference source.
- Treat `docs/current-erp-inventory.md` as stale until it is refreshed; it predates several settlement, reporting, and configuration updates.
- Do not reopen the original site unless a field-level ambiguity is blocking implementation.
