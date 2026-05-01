# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] — 2026-05-01

Wave-port of `spec-status.py` features into `spec_lint`. Closes the v0.1.0 gap where the TS port covered only basic lint while the Python script enforced richer canonical-shape contracts.

### Added

- **Strict-parsing rules** (`src/lint/strict.ts`) — 7 categories ported from `spec-status.py`'s `strict.py`:
  - `strict-bullets` — non-canonical `*` bullet
  - `strict-numbered-checklist` — `1. [ ]` numbered shape
  - `strict-alt-state` — `[/]` / `[~]` / `[?]` checkbox states
  - `strict-alt-marker` — `[BLOCKED]` / `[NCA]` / `[TODO]` / `[WIP]` / `[WAIT]` / `[NEEDS-DECISION]` (use `[HUMAN]`)
  - `strict-frontmatter` — YAML/TOML frontmatter fence at line 1
  - `strict-priority-heading` — `## Priority N` / `## Phase N` (use `## P<n>`)
  - `strict-priority-in-nontasks` — `## P<n>` in spec.md/plan.md
- **Cross-cutting checks** (`src/lint/cross_cutting.ts`):
  - `ready-to-close` — active spec with `open=0`, `done>0`, no `[HUMAN]` gates
  - `not-indexed` / `orphan-indexed` — `specs/active/` ↔ `specs/README.md` parity
  - `orphan-done` — `specs/done/` parity
  - `human-uncrossed` — `[HUMAN]` gate present but slug not in `HUMAN_BLOCKERS.md`
- **HUMAN_BLOCKERS analysis** (`src/lint/blockers.ts`):
  - `blocker-stale` — entry ≥7 days old
  - `blocker-stub` — empty / RESOLVED / SUPERSEDED body
  - `blocker-orphan` — references non-active or non-`[HUMAN]` spec
- **`spec_lint` tool** new params:
  - `no_strict?: boolean` — skip strict-parsing pass
  - `fail_on?: string[] | "all"` — exit-code gating on category set

### Changed

- `spec_lint` whole-tree mode (no `slug` arg) now appends cross-cutting + blocker findings after per-spec lint.
- Citadel-parity test still passes: 22 findings (5 strict-warning additions for real citadel deviations), exit_code 0 on both sides.

### Stats

- **225 tests** (was 204) across 30 files.
- 11 strict-rule tests + 5 cross-cutting tests + 5 blocker tests added.

## [0.1.0] — 2026-05-01

First public release. End-to-end SDD lifecycle wrapped as an MCP stdio server.

### Added

- **17 MCP tools** exposed over stdio (`@modelcontextprotocol/sdk` 1.x):
  - Read: `spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor`.
  - Atomic write: `spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff`.
  - Composite write: `spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`.
  - Infrastructure: `spec_index_rebuild`, `spec_init`.
- **Profile system** with extends-chain inheritance (`default → bastion → citadel`), config at `specs/config.yaml`. Cycle detection + Zod schema validation.
- **Substrate**: parser (frontmatter pipe-table + inline-fallback, Q-table, tasks `## P0/P1/P2`), renderer (idempotent round-trip), state machine (six transitions), DTG formatter (ISO-8601 / `DDHHMMZMONYY`), git wrappers, post-write invariants.
- **Repo-hygiene**: AGENTS.md / HUMANS.md / SECURITY.md / CONTRIBUTING.md, `docs/{architecture,profile-system,decisions,mcp-tools,install}.md`, GitHub Actions CI with phase-aware guards, issue + PR templates, install.sh.
- **Citadel-parity tool** (`bun run lint:citadel-parity`): exit-code parity with archived `spec-status.py --strict --include-done`. Maintainer-run only — never in CI per [D-19](docs/decisions.md).
- **204 tests** across 27 files; bun test runner.
- **Synthetic-fixture suite** under `tests/spec-fixtures/` covering all five lifecycle states plus edge cases.

### Notes

- All write tools support `dryRun: true`.
- Composite tools honor `commit_style` and `push_policy` from the resolved profile.
- Local-only V1; no remote API, no telemetry ([D-8](docs/decisions.md)).
- Slug uniqueness enforced forever; not configurable ([D-9](docs/decisions.md)).
- 20 architectural decisions logged in [docs/decisions.md](docs/decisions.md).
