# citadel-sdd

MCP server wrapping the citadel **Spec-Driven Development** lifecycle.

**Status:** PRD draft only. Not yet implemented.

## Why

Per-spec ceremony in citadel runs ~15 hand-edited tool calls per claim/close cycle (status flips, decision-log ratify, tasks.md sync, `git mv` active→done, `specs/README.md` index splice, conventional-commit authoring). Five-spec sessions burn ~75 calls of pure mechanical work. This MCP collapses each lifecycle event into one atomic call.

## Where to start

Read [PRD.md](PRD.md). It is self-contained; the next agent does not need to recover session state.

## Position

Sibling of [`Rethunk-Tech/citadel`](https://github.com/Rethunk-Tech/citadel) at `/usr/local/src/com.github/Rethunk-Tech/citadel-sdd/`. Standalone repo / workspace.

## Build status

| Phase | State |
|-------|-------|
| PRD | DRAFT 011920ZMAY26 |
| Implementation | not started |
| Tested | not started |
| Installed | not started |
