# Architectural decisions

Permanent canon. Each decision is append-only — do not edit history. To reverse a decision, append a new entry that supersedes the prior one and reference the superseded number.

| # | Decision | Value | Ratified |
|---|----------|-------|----------|
| D-1 | License | MIT | 011945ZMAY26 |
| D-2 | Language / runtime | TypeScript on Bun | 011945ZMAY26 |
| D-3 | Config format + location | YAML at `specs/config.yaml` (single canonical path; no `.sdd/`, no env override) | 011945ZMAY26 |
| D-4 | Lint script provenance | Ported Python `spec-status.py` → TS; archived script remains source-of-truth for parity | 011945ZMAY26 |
| D-5 | Commit author identity | `git config user.name`/`user.email`; profile may override | 011945ZMAY26 |
| D-6 | Push policy | Profile-configurable (`never` / `on_close` / `always`) | 011945ZMAY26 |
| D-7 | Bastion features | Neutral default; `bastion` profile adds DTG/IRONLAW/voice; `citadel` extends `bastion` | 011945ZMAY26 |
| D-8 | Telemetry | Zero | 011945ZMAY26 |
| D-9 | Slug uniqueness | Enforced forever; not configurable | 011945ZMAY26 |
| D-10 | Versioning | Semver from `v0.0.x`; `v0.1.0` on first promotion-gate green | 011945ZMAY26 |
| D-11 | Repo path discovery | `git rev-parse --show-toplevel`; abort if no `specs/config.yaml` | 011945ZMAY26 |
| D-12 | DTG source | `new Date()` UTC; never accept caller-supplied. Format per profile | 011945ZMAY26 |
| D-13 | Q-table parser strictness | Canonical shape only; lint-fail on deviation | 011945ZMAY26 |
| D-14 | Atomicity | All-or-nothing per tool. Buffer edits in memory; write-all-or-restore | 011945ZMAY26 |
| D-15 | README done-row generation | Built from `spec.md` frontmatter + `summary` arg; never hand-edited blob | 011945ZMAY26 |
| D-16 | Multi-claimer collision | Refuse `spec_claim` if IN_PROGRESS with different owner | 011945ZMAY26 |
| D-17 | History preservation | Append `## History` row in `spec.md` per transition | 011945ZMAY26 |
| D-18 | Test fixtures | Synthetic-only; no private-repo content vendored into MIT public repo | 011958ZMAY26 |
| D-19 | Citadel parity | Off-CI, maintainer-run only; never in GitHub Actions (private-repo credential exposure) | 011958ZMAY26 |
| D-20 | Documentation canon | PRD.md is transient (deleted at v0.1.0); permanent canon distributes across `AGENTS.md`, `HUMANS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `README.md`, `docs/*` | 012005ZMAY26 |
| D-21 | Conformance flexibility | Profile gains `frontmatter_format` (`pipe-table` / `inline` / `any`; default `any`) and `lint_rules` (per-rule `error`/`warn`/`off` map; default `{}`). Allows teams to enforce a canonical frontmatter format on writes and to suppress or escalate specific lint categories without the blunt `no_strict` bypass. Backward-compat: all defaults preserve prior behavior. | 012353ZMAY26 |
| D-22 | Remove citadel built-in preset | The `citadel` profile was project-specific config leaked into the library. Consuming repos own their overrides in `specs/config.yaml`. Built-in profiles henceforth: `default` (neutral) and `bastion` (Bastion voice). | 012353ZMAY26 |
| D-24 | `specs/README.md` write policy | Full-file regeneration only in `spec_init` and `spec_index_rebuild`. All other index mutators use targeted table-row edits (`spec_readme`); strict global DTG sort of every row is restored only by `spec_index_rebuild`. | 051945ZMAY26 |
| D-25 | PARKED is non-terminal | PARKED gains two exit transitions: `spec_unpark` (→ IN_PROGRESS, mirror of `spec_park` with reverse `git mv`) and `spec_close` (→ DONE, "abandon parked spec"). Earlier framing treated PARKED as terminal; reality is that parked specs hold a wake trigger (calendar gate, customer inbound, Phase-N ratification) and need an in-tool path back to active work. Hand-editing frontmatter is forbidden by the discipline rule, so the only acceptable resolution is to add transitions. `spec_close` from BLOCKED remains rejected — `spec_unblock` first; error message names that explicitly. Closes Rethunk-AI/citadel-sdd#1. | 101945ZMAY26 |
| D-26 | `spec_list` slim + pagination | `spec_list` gains `slim: boolean` (compact row `{slug,state,dtg,owner,p0,p1,p2,tasks}`, ~80 bytes/row) plus `limit` / `offset` cursor-style pagination. Default row also gains `tasks: {checked,total}` so callers can render progress bars without fanning out to `spec_task_list` per slug. Driven by a real client hitting 55 kB / 211-spec output cap (Rethunk-AI/citadel-sdd#2). Existing array-shape and field names preserved; back-compat clean. | 101950ZMAY26 |

## Adding a decision

1. Append next sequential number with full context (decision, value, DTG).
2. Reference in the commit body that introduces or implements it.
3. If superseding a prior decision, cite the superseded number in the new entry's value column.
4. Do not edit prior entries. History is permanent.
