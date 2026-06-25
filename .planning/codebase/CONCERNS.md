# Codebase Concerns

**Analysis Date:** 2026-06-25

## Tech Debt

**Placeholder API routes still wired into the app surface:**
- Issue: Several `/api/masters/*` and `/api/setup/status` routes return hardcoded `{ status: "placeholder" }` instead of real data. They are also among the only routes with no auth check.
- Files: `src/app/api/masters/customers/route.ts`, `src/app/api/masters/items/route.ts`, `src/app/api/masters/vendors/route.ts`, `src/app/api/setup/status/route.ts`
- Impact: Dead endpoints that may mislead clients; real master-data lives at `src/app/api/customers/route.ts`, `src/app/api/items/route.ts`, `src/app/api/vendors/route.ts`. Two parallel "masters" namespaces invite confusion.
- Fix approach: Remove the placeholder `masters/*` routes (and the matching `src/app/(protected)/masters/*` pages if unused) or implement them; consolidate on the working `customers`/`items`/`vendors` routes.

**No project-level ESLint configuration:**
- Issue: No `.eslintrc*` or `eslint.config.*` at the repo root, yet `// eslint-disable-next-line` comments exist in 13 component/page files. Lint is effectively unenforced (only Next's built-in defaults, and `next lint` is not in `package.json` scripts).
- Files: `package.json` (no `lint` script), disables in `src/app/(protected)/reports/ReportTableClient.tsx:108`, `src/components/OpeningBalanceManagers.tsx:200,348,496`, and 9 others.
- Impact: Style/quality drift; `react-hooks/exhaustive-deps` suppressed in many data-fetching effects (see Fragile Areas).
- Fix approach: Add an explicit ESLint config and a `lint` script; review each suppressed `exhaustive-deps`.

**Two prisma client import styles:**
- Issue: Server code imports prisma via relative `.ts` paths (`../../lib/prisma.ts`) while `src/lib/rbac.ts` uses the `@/lib/prisma` alias. Inconsistent and makes refactors error-prone.
- Files: `src/lib/rbac.ts` (alias) vs `src/server/auth/session.ts`, `src/server/api/request-context.ts` (relative `.ts`).
- Fix approach: Standardize on one import strategy.

**Duplicate / leftover output directories committed-adjacent:**
- Issue: `graphify-out/`, `graphify-output/`, `backups/`, `.local-postgres/`, plus stray logs (`embedded-postgres.out.log`, `next-dev.out.log`) and `# ERP Reverse Engineering Report.txt` clutter the repo root.
- Files: repo root.
- Impact: Noise; risk of accidentally committing large artifacts. `backups/` and `.local-postgres/` are gitignored (good) but the `graphify-*` dirs and logs are not all covered.
- Fix approach: Extend `.gitignore` to cover `graphify-out/`, `graphify-output/`, root `*.log`, and remove the stray report text file.

## Known Bugs

**Redundant permission lookup helpers with divergent semantics:**
- Symptoms: `userCan` (`src/lib/rbac.ts`) does NOT filter on `role.status = "ACTIVE"`, while `enforcePermission` (`src/server/services/rbac/enforce.ts`) DOES. A user whose role was deactivated can still pass `userCan` checks.
- Files: `src/lib/rbac.ts:5-13` vs `src/server/services/rbac/enforce.ts:13-22`.
- Trigger: Deactivate a role, then hit a code path that authorizes via `userCan` instead of `enforcePermission`.
- Workaround: Prefer `enforcePermission` everywhere; audit any callers of `userCan` and add the `status: "ACTIVE"` filter.

## Security Considerations

**Session cookie missing `Secure` flag:**
- Risk: `sessionCookieValue` sets `HttpOnly; SameSite=Lax` but never `Secure`. Over plain HTTP the 32-byte session token can be intercepted.
- Files: `src/server/auth/session.ts:21-23`, theme cookie in `src/lib/theme.ts`.
- Current mitigation: HttpOnly + SameSite=Lax limit XSS/CSRF exposure; 12-hour expiry.
- Recommendations: Append `Secure` in production (`process.env.NODE_ENV === "production"`). Consider `SameSite=Strict` for the session cookie.

**Test-mode header auth bypass:**
- Risk: `getRequestContext` trusts `x-company-id` / `x-financial-year-id` / `x-user-id` headers when `NODE_ENV === "test"`, fully bypassing session auth.
- Files: `src/server/api/request-context.ts:18-25`.
- Current mitigation: Gated on `NODE_ENV === "test"`, which should never be set in production.
- Recommendations: Verify deployment never runs with `NODE_ENV=test`; consider an additional explicit env guard (e.g. `ALLOW_TEST_AUTH`) so a misconfigured env var alone cannot open the bypass.

**No rate limiting on login or any endpoint:**
- Risk: `POST /api/auth/login` has no throttling, enabling brute-force/credential-stuffing against `loginId`/password.
- Files: `src/app/api/auth/login/route.ts`, no middleware (`src/middleware.ts` does not exist).
- Current mitigation: scrypt hashing with `timingSafeEqual` (`src/server/auth/password.ts`) — login verification is constant-time and slow per attempt.
- Recommendations: Add per-IP/per-account rate limiting and lockout; introduce a Next.js `middleware.ts` for cross-cutting protection.

**Password hashing scheme is fixed-cost scrypt with no parameter versioning:**
- Risk: `scryptSync(password, salt, 64)` uses Node defaults (N=16384). Format is `scrypt$salt$hash`; there is no cost/parameter field, so future hardening cannot be rolled forward per-hash.
- Files: `src/server/auth/password.ts:3-19`.
- Current mitigation: scrypt + per-user salt + constant-time compare is acceptable today.
- Recommendations: Encode cost parameters in the stored hash to allow future upgrades.

**Expired sessions never purged:**
- Risk: `session` rows accumulate forever; expired tokens are rejected at read time but rows are only deleted on explicit logout (`deleteSessionByToken`).
- Files: `src/server/auth/session.ts:42-82` (no sweep for `expires < now`).
- Current mitigation: Expiry is checked on every `getSessionContextFromToken`.
- Recommendations: Add a periodic cleanup (`session.deleteMany({ where: { expires: { lt: new Date() } } })`).

**`Content-Disposition` echoes user-supplied filename:**
- Risk: Backup download sets `filename="${filename}"` from the route param.
- Files: `src/app/api/database-backup/download/[filename]/route.ts:25`.
- Current mitigation: `resolveBackupFilePath` enforces strict regex `^backup-[\w.-]+\.(dump|sql|gz)$` (`src/server/services/backup/database-backup.ts:152-156`), which blocks path traversal and header-injection characters. Currently safe.
- Recommendations: Keep the regex as the single source of truth; do not relax it.

## Performance Bottlenecks

**Per-request permission queries with no caching:**
- Problem: Every protected service call runs a fresh `rolePermission.findFirst` join (`role -> userRoles -> permission`) via `enforcePermission`; `/api/auth/session` additionally fetches all permission keys on each call.
- Files: `src/server/services/rbac/enforce.ts`, `src/server/services/rbac/permissions.ts`, used in 33 service locations.
- Cause: No memoization of a user's permission set within a request or short TTL cache.
- Improvement path: Resolve the full permission set once per request and pass it down, or cache per session token.

**Session validation does two queries on cold financial-year:**
- Problem: When `user.financialYear` is null, `getSessionContextFromToken` issues a second `financialYear.findFirst` on every authenticated request.
- Files: `src/server/auth/session.ts:55-64`.
- Improvement path: Backfill `user.financialYearId` once at login rather than re-resolving per request.

## Fragile Areas

**Suppressed `react-hooks/exhaustive-deps` in data-fetching effects:**
- Files: `src/app/(protected)/reports/ReportTableClient.tsx:108`, `src/app/(protected)/reports/DailyActivityReportClient.tsx:81`, `src/app/(protected)/reports/sale-between-dates/page.tsx:82,87`, `src/app/(protected)/reports/group-summary/page.tsx:41`, `src/components/OpeningBalanceManagers.tsx:200,348,496`, `src/components/MultiLinePaymentForm.tsx:99`, `src/components/ProfitLossReportClient.tsx:232`, `src/components/StockLedgerPageClient.tsx:33`, `src/app/(protected)/configuration/user-management/UserManagementClient.tsx:53`, `src/app/(protected)/database-backup/DatabaseBackupClient.tsx:48`.
- Why fragile: Disabled dependency arrays mean effects may use stale closures (old filters/date ranges) when props change, producing wrong report data without an error.
- Safe modification: When editing these effects, re-derive correct dependencies or extract a stable fetch callback; do not blindly extend the disabled effect.
- Test coverage: Report services are tested at the service layer (`tests/operational-reports.test.mjs`, `tests/sales-reports.test.mjs`, etc.) but the client-side effect wiring is not.

**Large multi-responsibility service files:**
- Files: `src/server/services/opening-balances/opening-balances.ts` (722 lines), `src/server/services/reports/financial-ledgers.ts` (623), `src/server/services/master-data/master-data.ts` (608), `src/server/services/sales/sale-lpg.ts` (592), `src/components/OpeningBalanceManagers.tsx` (627).
- Why fragile: High line count concentrates accounting/inventory logic; changes risk cross-cutting regressions.
- Safe modification: Lean on the existing test suite (e.g. `tests/opening-balances.test.mjs`, `tests/sales-reports.test.mjs`) before/after edits; consider splitting by sub-domain.

## Scaling Limits

**Single global Prisma client, embedded Postgres for local dev:**
- Current capacity: Local development uses `embedded-postgres` (`.local-postgres/`); production points at a managed Postgres (Neon/Vercel per `.env.vercel`).
- Limit: Connection pooling is the default Prisma behavior; no explicit pool tuning. Serverless (Vercel) deployments can exhaust connections without a pooler.
- Scaling path: Use a connection pooler (PgBouncer / Neon pooled URL) for serverless; confirm `DATABASE_URL` uses the pooled endpoint in production.

**Local/Neon DB mismatch is a known footgun:**
- Current capacity: Migrations run via `prisma migrate deploy` in the `build` script.
- Limit: Dev (embedded Postgres) vs Neon divergence has previously caused issues (per project memory). Schema drift between the two is easy to introduce.
- Scaling path: Treat migrations as the single source of truth; never hand-edit either DB.

## Dependencies at Risk

**Pre-release `embedded-postgres` beta:**
- Risk: `embedded-postgres@^18.3.0-beta.17` is a beta dependency used for tests and local dev (`scripts/prepare-test-db.mjs`, `.local-postgres/`).
- Impact: Test/dev environment instability if the beta changes; not a production dependency.
- Migration plan: Pin the exact beta version (avoid `^` on a beta) or move local dev to a Docker Postgres (a `docker-compose.yml` already exists).

**Bleeding-edge React / Next pairing:**
- Risk: `react@19.2.5`, `react-dom@19.2.5`, `next@15.5.15` are very recent majors; ecosystem libs (e.g. `framer-motion@^12`) may lag.
- Impact: Upgrade-induced breakage; fewer community fixes for edge cases.
- Migration plan: Pin exact versions (already mostly pinned) and test upgrades behind the existing suite.

## Missing Critical Features

**No edge `middleware.ts` for route protection:**
- Problem: Auth is enforced per-route inside each handler via `getRequestContext`. There is no Next.js `middleware.ts`, so an accidentally-unauthenticated route (like the `masters/*` placeholders) silently exposes data.
- Blocks: Defense-in-depth; a single forgotten `getRequestContext` call = an open endpoint. 7 routes currently have no auth call (`masters/*`, `setup/status`, `health`, `auth/login`, `auth/login-options`).
- Fix approach: Add `src/middleware.ts` to require a valid session cookie for all `(protected)` pages and `/api/*` except an explicit allowlist (login, health).

**No centralized request-body validation library:**
- Problem: Validation is hand-rolled (`src/server/api/validation.ts` with `stringField`, `readJson`). No schema validation (Zod/Valibot).
- Blocks: Consistent, type-safe input validation across 118 routes.
- Fix approach: Adopt a schema validator for request bodies.

## Test Coverage Gaps

**Client-side React components and effects:**
- What's not tested: All `.tsx` components/pages, including the report clients with disabled `exhaustive-deps`. The suite (`tests/*.test.mjs`) is service-layer and API-contract focused, run via `node --test`.
- Files: `src/components/*`, `src/app/(protected)/**/*Client.tsx`.
- Risk: Effect/state bugs (stale filters, wrong date ranges) ship unnoticed.
- Priority: Medium.

**Auth, session, and RBAC enforcement paths:**
- What's not tested: No dedicated test for `verifyPassword`, session expiry/`Secure` cookie behavior, or the `userCan` vs `enforcePermission` `role.status` discrepancy. `tests/phase3c-auth-read.test.mjs` and `tests/rbac-management.test.mjs` exist but the divergent helper semantics are uncovered.
- Files: `src/server/auth/password.ts`, `src/server/auth/session.ts`, `src/lib/rbac.ts`.
- Risk: Authorization regressions (deactivated-role bypass) go undetected.
- Priority: High.

**Unauthenticated/placeholder routes:**
- What's not tested: No assertion that every `/api/*` route requires auth, which would have caught the `masters/*` placeholders.
- Files: `src/app/api/masters/*`, `src/app/api/setup/status/route.ts`.
- Risk: Open endpoints.
- Priority: High.

---

*Concerns audit: 2026-06-25*
