# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] — 2026-05-05

### Added

- **`specs/parked/`** lifecycle bucket and **PARKED** state (superseded / withdrawn specs).
- **`spec_park`** — legal from DRAFT, APPROVED, IN_PROGRESS, or BLOCKED; `git mv` from `specs/active/<slug>/` to `specs/parked/<slug>/`; requires non-empty `resolution`; refreshes `specs/README.md` (three tables: Active, Done, Parked).
- **`spec_lint.include_parked`** — optional inclusion of `specs/parked/` in tree-wide scans; composes with `include_done`.
- **`spec_list` state `parked`** and cross-cutting **orphan-parked** index parity when the Parked table is present.
- **`spec_init`** creates `specs/parked/.gitkeep`; **`spec_index_rebuild`** returns `parked_count`.

### Dependencies

- Routine `bun update` refresh (notably `yaml`, `zod`).

### Fixed

- **`lastTouchedBulk` test** — assert against `git log --format=%cs` instead of UTC calendar `toISOString()`, avoiding local/UTC date skew near midnight.

### Stats

- **301 tests** across 40 files.

## [0.3.0] — 2026-05-02

User-feedback driven ergonomics pass. Closes five pain points reported from live close-out sequences: batch task checking, circular spec-close task dependency, opaque match errors, heavyweight reads, and dirty-state accumulation from `commit: false`.

### Added

- **`spec_task_list`** — new lightweight tool that reads `tasks.md` only and returns `[{ phase, index, text, checked, isHumanGate }]`. `index` is 1-based and usable directly as the `match` param in `spec_task_check`. Replaces the common pattern of calling `spec_read` just to discover task text.
- **`spec_task_check` batch mode** — new `items: [{ phase, match, checked }][]` input param. Check/uncheck N tasks in a single MCP call with one file read, one write, and one commit. Flat `phase` + `match` + `checked` params still work (normalised to `items[0]` internally).
- **`spec_task_check` output: `matched_text` + `matched_index`** — every response (including `dryRun: true`) now returns the resolved task text and 1-based index alongside `before`/`after`. Batch calls return a `results[]` array with per-item resolution; single-item calls keep backward-compat top-level aliases.

### Fixed

- **`spec_close` circular dependency** — closing a spec when the final task item is named something like "E4. Spec close." no longer requires manually pre-checking that item. Items whose text matches `/spec.?close/i` are skipped in the `tasks_open` guard; they are auto-checked during the close operation itself.
- **`spec_task_check` opaque match error** — `task_not_found` now lists all available task text strings (up to 50 chars each) so callers can correct the `match` prefix without a follow-up read call.
- **`parseStatusValue` — bold-only status** — `**DRAFT**` (bold, no DTG) previously threw `status_unparseable`. DTG is now optional in the regex. Fixes `spec_claim` and `spec_read` on hand-written specs that omit the timestamp.
- **`renderStatusValue` + `formatStatusForFrontmatter` trailing space** — when `dtg` is empty (e.g. after parsing `**DRAFT**`), the rendered output previously included a trailing space (`DRAFT ` or `**DRAFT **`). Fixed to omit the space token when DTG is empty.
- **`spliceFrontmatter` — insert instead of throw on missing frontmatter** — writing to a file with no existing frontmatter block previously threw `frontmatter_missing`. Now inserts a pipe-table after the title line. `format: "inline"` inserts inline key-value lines instead.
- **`spliceFrontmatter` — inline→pipe-table insert position** — conversion from inline to pipe-table previously prepended the table before the document title. Now inserts after the title line using the new `insertAfterTitle` helper.

### Stats

- **292 tests** (was 281) across 39 files.
- +7 `spec_task_list` tests, +4 `spec_task_check` batch/output tests, +6 `spliceFrontmatter` format tests, +3 `renderStatusValue` empty-DTG tests.

## [0.2.0] — 2026-05-01

Tier 1+2 port of `spec-status.py` reporting + discovery features. Unblocks cross-repo / agent-fleet usage and exposes git-derived posture signals on `spec_status`. No breaking changes — all new params are optional.

### Added

- **Multi-root + nested-scan discovery** (`src/discovery/roots.ts`):
  - `findSingleRoot(start)` — walk-up auto-detect.
  - `resolveRoots(paths[])` — validate + dedupe explicit roots.
  - `scanNested({ parent, depth })` — walk up to N levels for `*/specs/active/`, skipping noise dirs (`node_modules`, `.git`, `dist`, `build`, etc.) and symlinks.
  - `selectRoots({...})` — single dispatch entry point.
- **Git history layer** (`src/spec/git_history.ts`):
  - `lastTouchedBulk` — `{slug → ISO date}` of most recent commit per spec, rename-aware.
  - `recentCommits` — last-N subjects for a single spec dir.
  - `daysBetween` — UTC day delta helper.
  - Graceful degradation on missing-git / non-repo trees.
- **Closure-reason ladder** (`src/lint/closure.ts`): `uninitialised → open_human → open_tasks → progress_file → not_indexed → ready`.
- **`spec_lint` new params**:
  - `roots?: string[]` — fan out across multiple meta-roots (each finding tagged with `root`).
  - `scan_nested?: { parent, depth? }` — walk-tree discovery; takes precedence over `roots`.
  - `stale_days?: number` — emit `stale` warning when active spec's last commit is older than threshold.
  - Output gains `roots?: string[]` (when multi-root) and `root?: string` per finding.
- **`spec_lint` new categories**: `stale`, `missing-tasks`, `missing-spec`, `missing-plan`, `progress-file`. All warnings; `fail_on: "all"` includes them.
- **`spec_status` new params**: `recent_limit?: number`, `since?: string` (git-log filter).
- **`spec_status` new optional output fields**:
  - `last_touched?: string` (ISO date), `days_since?: number`.
  - `reason?: ClosureReason` (active specs only).
  - `by_source?: Partial<Record<"tasks"|"plan"|"spec", { open, done, human }>>` — checklist breakdown by file (diagnostic for stray non-tasks checklists).
  - `recent_commits?: string[]` when `recent_limit` set.

### Changed

- Citadel-parity test still passes: 24 findings, exit 0 on both sides. (Increase from 22 reflects the 2 cross-cutting + parity-preserving warnings introduced by the closure ladder applied through cross_cutting; no behaviour regression.)

### Stats

- **262 tests** (was 225) across 37 files.
- 6 git_history tests + 4 stale tests + 7 closure tests + 4 missing-file tests + 3 checklist-scan tests + 4 spec_status recent tests + 10 discovery tests.

### Notes

- Components heuristic and TODO.md-backlog parsing intentionally NOT ported — Bastion-private / convention-specific. Per v0.1.1 decision pivots.
- Emit-format helpers (markdown / one-line summary / text-table) deferred to v0.3.x or post-CLI surface; MCP returns structured JSON natively.
- Cache layer for `lastTouchedBulk` deferred — no perf signal yet.

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
