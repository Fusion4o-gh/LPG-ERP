# Changelog

## Unreleased — 2026-08-03

### Product and parity

- Added bulk-product master data and global keyboard search.
- Added reference-oriented import, plant, dollar, contract, partial-receiving, and partial-sale workflows.
- Added balanced manual and dollar journal vouchers, reversals, opening-voucher controls, day-close controls, and audit coverage.
- Added CSV and print output across accounting, inventory, contract, loading, dollar, stock-ledger, audit-log, and voucher-list surfaces.
- Added reconciliation summaries to accounting reports and local-date-safe transaction defaults.
- Added company-branded printable transaction documents and improved Microsoft/Apple-inspired spacing, focus, disabled states, tables, and responsive actions.
- Fixed numeric form values reaching string-only validators, including the `openingBalance must be a string` warning.

### Verification

- Full automated suite: 457 passing, 0 failing (current run).
- Full visible-route smoke: 133/133 authenticated routes returned HTTP 200 with zero failures.
- TypeScript validation and production build passed; build generated 321 pages.
- Added regression assertions for voucher CSV output and sensitive-field-safe audit CSV output.

### Deferred

- Historical legacy-data import/reconciliation is explicitly deferred. The supplied archive contains encrypted/encoded SQL and no authorized decryption key is available.
