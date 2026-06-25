# Technology Stack

**Analysis Date:** 2026-06-25

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (`src/**/*.ts`, `src/**/*.tsx`); strict mode enabled (`tsconfig.json`)

**Secondary:**
- JavaScript (ESM `.mjs` / CommonJS `.cjs`) - Tooling and scripts only (`scripts/`, `prisma/seed.js`, `tests/*.test.mjs`)
- SQL - Prisma migrations (`prisma/migrations/`)

## Runtime

**Environment:**
- Node.js 22 (pinned via `node:22-alpine` in `Dockerfile`; `@types/node` 22.19.17)
- Next.js 15.5.15 App Router server runtime (React Server Components + Route Handlers)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)
- Registry/retry config: `.npmrc` (npm registry, aggressive fetch-retry settings, audit/fund disabled)

## Frameworks

**Core:**
- Next.js 15.5.15 - Full-stack framework; App Router under `src/app/`, API via Route Handlers (`src/app/api/**/route.ts`, 118 route files)
- React 19.2.5 / React DOM 19.2.5 - UI layer
- Prisma 6.19.3 (`@prisma/client` 6.19.3) - ORM and migration engine; schema at `prisma/schema.prisma` (49 models)

**Testing:**
- Node.js built-in test runner (`node --test`) - No third-party test framework; specs in `tests/*.test.mjs`
- `embedded-postgres` ^18.3.0-beta.17 - Spins up a real Postgres instance for tests (`scripts/prepare-test-db.mjs`, `tests/helpers/`)

**Build/Dev:**
- TypeScript 5.9.3 - Type checking (`noEmit`, bundler module resolution)
- Tailwind CSS 3.4.19 - Styling (`tailwind.config.ts`)
- PostCSS 8.5.14 - CSS pipeline (`postcss.config.mjs`)
- framer-motion ^12.40.0 - UI animation

## Key Dependencies

**Critical:**
- `@prisma/client` 6.19.3 - Sole data-access layer; `postinstall` runs `prisma generate`
- `next` 15.5.15 - Application server, routing, build
- `react` / `react-dom` 19.2.5 - Rendering

**Infrastructure:**
- `embedded-postgres` (dev) - Local/test Postgres without external service; data dir `.local-postgres/`
- `prisma` (dev) - CLI for `migrate`, `generate`, `seed`

## Configuration

**Environment:**
- Configured via env files (`.env`, `.env.local`, `.env.example`, `.env.vercel`) - not read here for security
- Key variables referenced in code: `DATABASE_URL` (Postgres connection), `NODE_ENV`, `VERCEL` (disables local filesystem backups on Vercel)
- Database connection injected through `datasource db { url = env("DATABASE_URL") }` in `prisma/schema.prisma`

**Build:**
- `next.config.ts` - `reactStrictMode: true`
- `vercel.json` - framework `nextjs`, build `npm run build`, install `npm install`
- `tsconfig.json` - target ES2022, path alias `@/*` → `./src/*`, JSX preserve, strict
- Build command runs `prisma migrate deploy` then a patched Next build (`scripts/patch-exfat-readlink.js` workaround for exFAT filesystems)

## Platform Requirements

**Development:**
- Node.js 22, npm
- No external database required: `scripts/start-embedded-postgres.cjs` provides an embedded Postgres on port 5432 (user `lpg`)
- Run: `npm run dev` (Next dev server)

**Production:**
- Two supported targets:
  - Docker (`Dockerfile` multi-stage on `node:22-alpine`; `docker-compose.yml` bundles `postgres:16`)
  - Vercel (`vercel.json`, `.env.vercel`) with an external Postgres (e.g. Neon)
- Postgres 16 expected in container deployment

---

*Stack analysis: 2026-06-25*
