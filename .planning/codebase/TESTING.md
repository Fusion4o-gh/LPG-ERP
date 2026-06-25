# Testing Patterns

**Analysis Date:** 2026-06-25

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) — no Jest/Vitest.
- Tests are `.mjs` ES modules in `tests/`, run via `node --test tests/*.test.mjs`.
- Config: none beyond `package.json` scripts and `tests/helpers/test-env.mjs` (loaded with `--import`).

**Assertion Library:**
- Node built-in `node:assert/strict` (imported as `assert`).

**Run Commands:**
```bash
npm run test:prepare      # node scripts/prepare-test-db.mjs — provisions/migrates the test DB
npm test                  # prepare-test-db then: node --import ./tests/helpers/test-env.mjs --test tests/*.test.mjs
```
- `npm test` first runs `scripts/prepare-test-db.mjs`, then executes every `tests/*.test.mjs`.
- `--import ./tests/helpers/test-env.mjs` loads env and rewrites `DATABASE_URL` to the test DB before any test runs.

## Test File Organization

**Location:**
- Centralized in `tests/` (NOT co-located with source). ~38 test files, one per feature/domain (e.g. `decanting-sale.test.mjs`, `bank-payments-receipts.test.mjs`, `rbac-management.test.mjs`).

**Naming:**
- `<feature>.test.mjs`, kebab-case matching the domain/service it covers.

**Shared helpers** in `tests/helpers/`:
- `test-env.mjs` — loads `.env`/`.env.local`, resolves and asserts the safe test DB URL.
- `test-database.mjs` — DB URL resolution, name extraction, and `assertSafeTestDatabase` guard.
- `test-prisma.mjs` — Prisma client helper for tests.
- `lpg-fixtures.mjs` — seed/fixture builders (`isolatedFixture`, `doc(prefix)`, account/customer/vendor/bank setup).

## Test Structure

**Suite Organization:**
- Flat `test("name", async () => { ... })` calls — `describe()` blocks are NOT used.
- Each file imports `test` from `node:test` and `assert` from `node:assert/strict`.
- Implementation under test is loaded with **dynamic `await import("../src/...ts")`** at top level (so the TS loader resolves it):
```js
import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const decantingSales = await import("../src/server/services/sales/decanting-sale.ts");
```

**Teardown:**
- Per-file cleanup via `test.after(async () => { await prisma.$disconnect(); })`.

## Test Style

- **Integration-first against a real Postgres test database** — services and API route handlers are exercised end-to-end, not mocked.
- API routes are tested by constructing real `Request` objects with a session cookie and invoking the exported handler directly:
```js
async function authedJsonRequest(user, body) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });
}
```
- Permissions are granted in-test by upserting `Permission` + `RolePermission` rows (see `grant()` in `tests/decanting-sale.test.mjs`).

## Mocking

- **No mocking framework and minimal mocking by design.** Tests run against a real DB and real Prisma client. Sessions, RBAC, stock ledger, and vouchers are all created with real records.
- When isolation is needed, use `isolatedFixture(prisma, prefix)` and unique IDs via `doc(prefix)` (timestamp + random suffix) rather than stubbing.

## Fixtures and Factories

**Builders** live in `tests/helpers/lpg-fixtures.mjs`:
- `isolatedFixture(prisma, prefix)` → returns `{ company, financialYear, user, item, customer, vendor, bank, ... }` for an isolated scenario.
- `doc(prefix)` → unique document/source identifier: `\`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}\``.
- Helpers like `findControlAccount`, `ensureBankGlAccount` upsert required chart-of-accounts rows.
- Seed constants: `SEED_COMPANY_NAME = "LPG Management System"`, `SEED_ADMIN_PASSWORD`, `DEFAULT_TEST_DB = "lpg_management_system_test"` (in `tests/helpers/test-database.mjs`).

## Database Safety

- `assertSafeTestDatabase` (in `tests/helpers/test-database.mjs`) **refuses to run** unless the target DB name contains `test`, and rejects a test URL pointing at the dev DB. This is a hard guard against running the destructive suite against dev/prod data.
- `resolveTestDatabaseUrl` prefers `DATABASE_URL_TEST`, else derives `lpg_management_system_test` from `DATABASE_URL`.

## Coverage

- No coverage tooling configured and no enforced threshold. Coverage is breadth-driven: roughly one test file per feature/service.

## Test Types

- **Integration / service tests:** dominant — exercise services + DB (e.g. `sale-lpg`, `journal-voucher`, `general-ledger`).
- **API contract tests:** `tests/api-contract.test.mjs` validates route response envelopes.
- **RBAC/auth tests:** `tests/phase3c-auth-read.test.mjs`, `tests/phase3d-controls.test.mjs`, `tests/rbac-management.test.mjs`.
- **UI/theme/navigation tests:** `tests/ui-phase3b.test.mjs`, `tests/theme.test.mjs`, `tests/navigation.test.mjs` (assert structure/config, not browser rendering).
- **E2E (browser):** none — no Playwright/Cypress.

## Common Patterns

**Async testing:** all tests are `async` arrow functions awaiting real DB/service calls; assert with `assert.equal`, `assert.ok`, `assert.deepEqual`.

**Error testing:** use `assert.rejects` (or try/catch + assert) to verify services throw the expected `Error` messages, mirroring the validation/permission messages in `src/server/api/`.

**Adding a new test:** create `tests/<feature>.test.mjs`, build state with `isolatedFixture` + `doc`, grant any needed permissions, invoke the service or route handler, and `test.after` disconnect Prisma.

---

*Testing analysis: 2026-06-25*
