# Cross-AI Workflow

## Start here

1. Read `AGENTS.md`, `docs/AI_RUNTIME_RULES.md`, `docs/REPO_INDEX.md`, `docs/LOGIC_OWNERSHIP.md`, and `HANDOFF.md`.
2. Run `git status --short`; existing changes belong to the product owner.
3. Choose one bounded workstream and record it in the handoff before editing.

## Parallel work

- Parallel agents may work on independent surfaces only: for example, UI polish, report service coverage, and documentation.
- Do not have two agents edit the same file or migration at the same time.
- The integrating agent owns conflict resolution, final type-check, full tests, build, and route smoke.
- A subagent must return changed files, tests run, failures, and unresolved assumptions—not only a summary.

## Verification contract

For each change, report:

- behavior changed;
- authoritative files changed;
- focused tests and runtime checks;
- whether accounting/stock/audit invariants were exercised;
- remaining uncertainty and the next action.

## Deferred legacy import

Do not spend agent time attempting to decrypt the supplied historical archive. It is explicitly deferred by the user. Continue improving the live product, parity coverage, and local workflows; revisit migration only when an authorized decrypted SQL export and mapping are supplied.
