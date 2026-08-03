# AI Agent Operating Rules

## Before changing code

1. Inspect the worktree with `git status --short`.
2. Read `docs/AI_RUNTIME_RULES.md`, `docs/REPO_INDEX.md`, `docs/LOGIC_OWNERSHIP.md`, and the relevant module/pattern documentation.
3. Search for an existing service, API contract, enum, and UI abstraction before adding one.
4. Keep the diff focused. Do not reset, clean, reformat, or rewrite unrelated user work.

## Architecture rules

- Next.js App Router pages live under `src/app`; protected pages are under `src/app/(protected)`.
- Business rules belong in `src/server/services`; API routes validate/authenticate and delegate.
- Use the existing request context, permission checks, response helpers, document-number service, audit logging, and date helpers.
- Accounting writes must create balanced vouchers and immutable stock/cylinder/audit records where applicable.
- Never bypass company and financial-year scoping.
- Never expose passwords, tokens, hashes, or raw sensitive audit values in UI or exports.
- Do not invent enum values, permission keys, route names, or database fields; inspect Prisma and `docs/REFERENCE_ENUMS.md` first.

## Verification

Run the smallest relevant checks first, then the broader gate when practical:

```text
npx tsc --noEmit --pretty false
npm test
npm run smoke:local -- --base http://127.0.0.1:3003 --login admin --password 4784Shani --timeout 60000 --concurrency 1
npm run build
git diff --check
```

Do not claim a check passed unless it was run in the current work session. Document known warnings and deferred work in `CHANGELOG.md` or `HANDOFF.md`.

## Current scope

Historical legacy-data import is explicitly deferred. The supplied legacy archive is encrypted; do not attempt password cracking or enable write-import without an authorized key/decrypted SQL and a reviewed mapping.
