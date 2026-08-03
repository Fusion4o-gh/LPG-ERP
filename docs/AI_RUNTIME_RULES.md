# AI Runtime Rules

This file is the short operational contract for Codex, Claude Code, Cursor, and other agents working in this repository.

## Safety and ownership

- Treat the current worktree as authoritative and preserve existing changes.
- Use `apply_patch` for intentional source/document edits.
- Do not run destructive Git or filesystem commands without explicit authorization.
- Do not use production credentials or send live-demo data unless the user explicitly authorizes it for the current task.
- Keep secrets out of source, logs, screenshots, exports, and handoff notes.

## Implementation

- Trace UI -> API -> service -> Prisma before modifying behavior.
- Reuse existing abstractions and preserve public API response shapes unless a migration is documented.
- Put cross-workflow invariants at the shared service/transaction boundary, not only in a form.
- Add or update focused tests for every behavior change.
- Update the relevant inventory/parity document when a module changes.

## Handoff discipline

Every agent should leave behind: changed files, commands run, results, known limitations, and the next recommended action. Use `HANDOFF.md` as the current cross-agent checkpoint and `CHANGELOG.md` for user-visible history.
