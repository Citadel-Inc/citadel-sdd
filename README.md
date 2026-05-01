# citadel-sdd

MCP server wrapping the **Spec-Driven Development** lifecycle for Bastion, Citadel operators, Citadel customers, and public agent workflows.

**License:** MIT.
**Status:** PRD ratified 011945ZMAY26. Implementation Phase A pending.
**Language:** TypeScript on Bun.
**Repo:** [Rethunk-AI/citadel-sdd](https://github.com/Rethunk-AI/citadel-sdd).

## Why

Hand-driven SDD lifecycle = ~15 mechanical tool calls per spec claim/close cycle (status flips, decision-log ratify, tasks.md sync, `git mv` active→done, `specs/README.md` index splice, conventional-commit authoring). Five-spec sessions burn ~75 calls of pure ceremony. This MCP collapses each lifecycle event into one atomic call.

## Profiles

Three shipped profiles, inheritance-chained:

```
default (vanilla SDD baseline)
  └── bastion (DTG injection, IRONLAW callouts, militant commit voice)
        └── citadel (bastion + citadel paths/conventions + push-on-close)
```

Each consuming repo declares its profile in `specs/config.yaml`.

## Where to start

Read [PRD.md](PRD.md). Self-contained; no session-state recovery needed.

## Build status

| Phase | State |
|-------|-------|
| PRD | RATIFIED 011945ZMAY26 |
| Phase A (substrate) | not started |
| Phase B (tools) | not started |
| Phase C (MCP wiring) | not started |
| Phase D (close + parity) | not started |
| Tag v0.1.0 (parity green ×7) | not started |
