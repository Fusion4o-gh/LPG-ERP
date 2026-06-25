# External Integrations

**Analysis Date:** 2026-06-25

## APIs & External Services

This is a **self-contained ERP** with no third-party SaaS API integrations. There are no Stripe, AWS, payment-gateway, email, or external HTTP service clients in the codebase. All `fetch` calls are internal browser-to-own-API calls (`src/lib/api-client.ts`, same-origin relative URLs, `cache: "no-store"`).

**Confirmed external service calls:** None detected (grep for `fetch`/`axios`/`http(s)://` in `src/server` and `src/lib` returns only the internal API client).

## Data Storage

**Databases:**
- PostgreSQL (single relational database, 49 Prisma models)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma ORM via singleton `src/lib/prisma.ts`
  - Local/dev: `embedded-postgres` (`scripts/start-embedded-postgres.cjs`, data in `.local-postgres/`)
  - Container: `postgres:16` service (`docker-compose.yml`)
  - Production: external Postgres (Neon-style URL via `.env.vercel`)

**File Storage:**
- Local filesystem only - Database backups written to `backups/` directory (`src/server/services/backup/database-backup.ts`); disabled when `process.env.VERCEL === "1"`

**Caching:**
- None (Next.js fetch caching explicitly disabled with `cache: "no-store"`)

## Authentication & Identity

**Auth Provider:**
- Custom, self-hosted (no NextAuth/Auth0/Clerk)
  - Password hashing: Node `crypto.scryptSync` with per-user salt, stored as `scrypt$<salt>$<hash>` (`src/server/auth/password.ts`); verification via `timingSafeEqual`
  - Sessions: opaque random tokens (`crypto.randomBytes(32)`) persisted in the `Session` table, 12-hour expiry (`src/server/auth/session.ts`)
  - Session cookie: `lpg_erp_session` — `HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` (`src/server/auth/session-cookies.ts`)
  - Login: `src/app/api/auth/login/route.ts`; logout, change-password, session, login-options under `src/app/api/auth/`
  - Authorization: role-based access control (RBAC) in `src/server/services/rbac/` (`enforce.ts`, `permissions.ts`, `role-management.ts`) with `PermissionAction` enum (VIEW/CREATE/UPDATE/DELETE/PRINT/APPROVE/CLOSE_DAY/MANAGE_RBAC)
  - Multi-tenant scoping: every session carries `companyId` + `financialYearId`

**No middleware.ts** — auth is enforced inside route handlers / service layer via session context helpers, not Next.js middleware.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Datadog). Errors surfaced via standardized API responses (`src/server/api/responses.ts`)

**Logs:**
- Prisma query logging only — `["error","warn"]` in development, `["error"]` otherwise (`src/lib/prisma.ts`)
- Embedded Postgres logs to `embedded-postgres.out.log` / `.err.log`

## CI/CD & Deployment

**Hosting:**
- Vercel (`vercel.json`, `.vercel/`, `.env.vercel`) and/or self-hosted Docker (`Dockerfile`, `docker-compose.yml`)

**CI Pipeline:**
- None detected (no `.github/workflows`, CircleCI, or other CI config in repo)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - Postgres connection string (required by Prisma)
- `AUTH_SECRET`, `AUTH_URL` - referenced in `docker-compose.yml` deployment env
- `VERCEL` - platform flag; when `"1"` disables local filesystem backups
- `NODE_ENV` - controls Prisma logging and Prisma client global caching

**Secrets location:**
- Env files (`.env`, `.env.local`, `.env.vercel`) — present but git-ignored; contents not inspected

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## System Integrations (non-network)

- `pg_dump` - Database backup invoked via `child_process.spawnSync` (`src/server/services/backup/database-backup.ts`); requires `pg_dump` on PATH, gracefully degrades if unavailable

---

*Integration audit: 2026-06-25*
