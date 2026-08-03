# LPG-ERP Cross-Agent Handoff

Updated: 2026-08-03

## Current state

The local LPG ERP replacement is a broad, service-backed implementation of the audited reference modules. The local development server is intended to run at `http://localhost:3003`.

Latest recorded verification:

- `npm test`: 457 passed, 0 failed (current run).
- `npx tsc --noEmit --pretty false`: passed.
- `npm run build`: passed; 321 pages generated.
- Focused route smoke passed for `/stock-ledger`, `/audit-log`, and `/accounting/vouchers`.
- Focused export regression coverage passes: phase3c 8/8 and phase3d 12/12, including voucher CSV and sensitive-field-safe audit CSV.
- Full authenticated route smoke: 133/133 visible routes returned HTTP 200 with zero failures.

Operational note: running `npm run build` while `next dev` is active can corrupt the shared `.next` React Client Manifest temporarily. If that occurs, restart the dev server; the affected routes recovered and `/stock-ledger`, `/audit-log`, and `/accounting/vouchers` then returned HTTP 200.

## Start commands

```text
set DATABASE_URL=postgresql://lpg:lpg_dev_password@localhost:5432/lpg_management_system?schema=public
set AUTH_SECRET=local-dev-secret
set PORT=3003
npm run dev
```

Local seeded admin used by smoke tests: login `admin`, password `4784Shani`. Use only against the local development database.

## Important implementation boundaries

- Business logic belongs in `src/server/services`, not page components.
- Accounting writes must remain balanced and company/financial-year scoped.
- Stock, cylinder accountability, audit, and reversal records are immutable workflow outputs.
- The shared business-date/day-close guard must protect every transaction write.
- CSV and JSON report outputs must share the same filtered calculation path.
- Keep sensitive audit values masked; never export passwords, tokens, hashes, or secrets.

## Current changed surfaces

Recent parity work includes `StockLedgerPageClient`, stock-ledger CSV, `AuditLogViewer`, audit-log CSV, `VoucherListPageClient`, voucher-list CSV, report print actions, and associated parity documentation. The worktree contains many earlier product changes; preserve them and do not reset or clean them.

## Explicitly deferred

Historical legacy-data import is out of scope for the current workstream at the user's direction. The available ZIP contains an encrypted/encoded SQL payload. Do not crack it or enable write-import. Resume only with an authorized decryption key or decrypted SQL plus reviewed table mapping.

## Next best actions

1. Finish and record the full authenticated route smoke result.
2. Run the isolated production build after any active edits.
3. Run `git diff --check` and review only the intended diff.
4. Continue closing documented UI/report parity gaps from `docs/parity-roadmap.md`.
5. Keep this file and `CHANGELOG.md` current after each meaningful workstream.

## Current parity caveat

The implementation and route surface are verified locally, but “exact” legacy totals and print typography cannot be proven without reference sample data. Historical import is deferred; do not represent this caveat as a code failure.
