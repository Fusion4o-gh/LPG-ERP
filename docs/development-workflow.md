# Development Workflow

Use this workflow for future LPG ERP work.

## Start With Locked Decisions

Read `docs/architecture-decisions.md` before changing architecture, stack, domain rules, auth, database behavior, or UI direction. Do not reconsider locked decisions unless the task explicitly asks for that.

## Target Files Efficiently

Use `docs/graphify-usage.md` and `graphify-output/GRAPH_REPORT.md` only to identify likely relevant files. Do not infer architecture from noisy generic route handler nodes such as `GET()`, `POST()`, or `PUT()`. Prefer file paths, service names, domain names, and named functions.

## Inspect Before Editing

Before coding, read the relevant files and infer the existing pattern. Inspect the smallest useful set of source files, tests, and docs for the assigned scope.

## Keep Scope Small

Modify only files required by the task. Do not touch unrelated services, UI, reports, schema, migrations, or tests. Preserve existing APIs and data shapes unless the task explicitly requires a contract change.

## Preserve Domain Boundaries

UI calls API routes. API routes call services. Services own business logic. Frontend code must not duplicate accounting, stock, RBAC, document-number, closed-day, audit, or reversal rules.

## Validate Appropriately

Run only validations relevant to the assigned change unless the task asks for a full checkpoint. Do not claim validation passed unless the command was actually run.

Typical focused validation:

- Service or API change: `npm test`
- Type/build-affecting change: `npm run build`
- Prisma/schema change only when explicitly assigned: `npx prisma validate` and `npx prisma generate`

## Report Clearly

Final responses should list changed files, tests or validation run, and remaining risks. Keep the report concise and do not include unrelated cleanup notes.
