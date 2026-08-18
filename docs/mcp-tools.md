# MCP Tools

Permanent canon for: tool inventory + per-tool inputs / outputs / failure modes.

Architecture taxonomy (read / write atomic / write composite / write infrastructure) is in [docs/architecture.md § Tool taxonomy](architecture.md#tool-taxonomy).

## Common parameters

| Field | Default | Notes |
| ------- | --------- | ------- |
| `workspaceRoot` | first MCP file root | Project-root override. Usually omit it: MCP clients that support roots provide the active workspace automatically. |
| `dryRun` | `false` | Preview only — no FS writes, no commits. Returns same diff as live call. |
| `commit` | profile-default | When `false`, leaves edits staged but does not commit. |
| `push` | profile-default | Push policy: `never` / `on_close` / `always`. |
| `format` | `"json"` | `"markdown"` for human-readable rollup. |

All tools resolve their project root at call time from `workspaceRoot`, MCP client roots, then process fallback. The fallback still honors `CITADEL_SDD_ROOT` for clients that do not support MCP roots, but normal client wiring does not require an environment variable.

## Common failure codes

| Code | Trigger |
| ------ | --------- |
| `state_invalid` | Requested transition not legal per [docs/architecture.md § State machine](architecture.md#state-machine). |
| `slug_collision` | Slug already used under `active/`, `done/`, or `parked/`. Slugs are unique forever ([D-9](decisions.md)). |
| `slug_invalid` | Slug fails canonical pattern (lowercase kebab-case, no path separators). |
| `working_tree_dirty` | Dirty paths within the spec's own scope; every mutating tool now refuses unconditionally so a failed mutation can always be rolled back cleanly. |
| `ratify_required` | Q-table has `TBD` rows and `ratify=false`. |
| `tasks_open` | `spec_close` called with unchecked checkboxes outside `allow_open` whitelist. |
| `path_outside_repo` | Input path escapes `git rev-parse --show-toplevel`. Refused. |
| `path_is_symlink` | A spec's `spec.md` / `tasks.md` / `plan.md` is a symlink. Read and write both refuse — specs must be regular files. |
| `profile_chain_broken` | `extends:` references an unknown profile or exceeds the inheritance depth limit. |
| `profile_cycle` | `extends:` chain forms a cycle (a profile name recurs in its own resolution chain). |
| `config_invalid` | `specs/config.yaml` fails schema validation. |
| `owner_mismatch` | `spec_claim` against IN_PROGRESS spec held by a different owner. |
| `task_ambiguous` | A task `match` string is a prefix of more than one task; no task is mutated. |

---

## Read tools

### `spec_list`

List specs by state, optionally filtered to caller.

**Inputs:** `{ state?: "active"|"done"|"parked"|"blocked"|"all", mine?: boolean, slim?: boolean, limit?: number, offset?: number }`. Defaults: `state="active"`, `mine=false`, `slim=false`, no pagination.

**Output (default):** ordered array of `{ slug, state, dtg, owner, approved_dtg, ratified, p0_remaining, p1_remaining, p2_remaining, blockers, tasks: { checked, total } }`. Sort by DTG descending unless `mine=true` (then by remaining-task count ascending).

**Output (slim):** when `slim: true`, each row is `{ slug, state, dtg, owner, p0, p1, p2, tasks: { checked, total } }` (~80 bytes/row).

**Scaling note:** the default row is ~260 bytes; large backlogs (200+ specs across all buckets) with `state: "all"` exceed typical MCP client output caps (Rethunk-AI/citadel-sdd#2). Pass `slim: true` (~17 kB at 211 rows), or paginate with `{ limit, offset }`. The default `state: "active"` is intentionally narrow precisely so most callers stay under the cap.

### `spec_read`

Return combined spec + plan + tasks for a slug.

**Inputs:** `{ slug, parts?: ("spec"|"plan"|"tasks")[] }`. Default returns all three.

**Output:** `{ slug, state, spec_md, plan_md, tasks_md }`.

### `spec_status`

Single-spec status summary.

**Inputs:** `{ slug, recent_limit?: number, since?: string }`. `recent_limit` caps the number of history rows returned. `since` is an ISO-8601 or Bastion DTG string; only history entries at or after that timestamp are included.

**Output:** `{ slug, state, dtg, owner, approved_dtg, ratified, q_table: [{id, question, default, ratified_at}], task_counts: { p0:{open,done}, p1:{...}, p2:{...} }, blockers, last_commit_sha }`.

### `spec_lint`

Run strict-mode validation across the spec tree.

**Inputs:** `{ slug?, include_done?: boolean, include_parked?: boolean, no_strict?: boolean, fail_on?: string[]|"all", roots?: string[], scan_nested?: { parent: string, depth?: number }, stale_days?: number }`. Without slug, lints the whole tree. Default scans `specs/active/` only; `include_done` adds `specs/done/`; `include_parked` adds `specs/parked/` (flags compose). Per-spec `slug` lint resolves the slug wherever it lives. `no_strict` disables strict-mode rules. `fail_on` sets which rule codes (or `"all"`) cause a non-zero exit. `roots` overrides the set of spec-tree roots to lint. `scan_nested` walks `parent` up to `depth` levels looking for nested spec trees. `stale_days` overrides the profile default for stale-spec detection.

**Output:** `{ findings: [{severity, message, path, slug?}], exit_code }`. Exit-code parity with archived Python script is enforced ([D-4](decisions.md)).

### `sdd_doctor`

Diagnose existing repo, infer best-match profile, flag drift.

**Inputs:** `{}` (or empty).

**Output:** `{ inferred_profile, findings: [{severity, message, path}], drift: boolean, recommendations: string[], scaffold_repairs: string[] }`. `scaffold_repairs` lists repo-relative paths created when missing `specs/<active|done|parked>/` buckets were repaired (empty `.gitkeep` in new dirs); empty when the layout was already complete.

Runs `spec_lint` with `include_done: true` and `include_parked: true` so parked and archived specs participate in the health rollup. Does not create `specs/` itself when absent (use `spec_init`).

---

### `specs/README.md` index edits

Implementation: `src/spec/spec_readme.ts` (targeted edits) and `src/spec/index_render.ts` (`renderIndex` full rewrite).

| Mode | Tools | Behavior |
| ------ | ------- | ---------- |
| Full rewrite | `spec_init`, `spec_index_rebuild` | Replace `${spec_dir}/README.md` via `renderIndex`; chronological sort of every table row |
| Targeted edit | `spec_handoff`, every `spec_transition` action except `ratify` | Find each machine table header (`\| Slug \| State \| DTG \| Owner \|` or `\| Slug \| DTG \| Note \|`), remove the slug from all three tables, restore `\| _(none)_ \|` when empty, insert the new row immediately after the separator in the destination bucket |

Targeted edits preserve content after the Parked table (for example `## Notes`). Partial updates move only the touched slug to the top of its bucket. Missing headings or headers → `readme_unparseable`; run `spec_index_rebuild` or `spec_init` on a fresh tree.

---

## Write atomic tools

### `spec_task_check`

Flip one or more `tasks.md` checkboxes in a single call.

**Inputs:** `{ slug, items: [{ phase: "P0"|"P1"|"P2", match: string|number, checked: boolean }] }` (non-empty). `match` is exact-match prefix or 1-based index within phase; items are applied in order and a `task_not_found` on any item aborts the whole call before writing.

**Output:** `{ slug, results: [{phase, matched_index, matched_text, before, after}], matched_text, matched_index, before, after, commit_sha }`. The top-level `matched_text`/`matched_index`/`before`/`after` mirror `results[0]` for single-item callers.

### `spec_task_add`

Append a checklist item to a phase.

**Inputs:** `{ slug, phase, text, blocker?: boolean }`.

**Output:** `{ slug, added_index, commit_sha }`.

### `spec_handoff`

Reassign owner without state flip.

**Inputs:** `{ slug, new_owner, note? }`.

**Output:** `{ slug, before_owner, after_owner, commit_sha }`. Updates the Active table row in `${spec_dir}/README.md` when committing.

**Failure modes:** `handoff_invalid_state` (handoff is only legal while a spec is `IN_PROGRESS` or `BLOCKED` — it reassigns ownership without a state flip), `spec_not_found`, `working_tree_dirty`.

---

## `spec_transition`

Single MCP surface for every lifecycle-state transition. `to` selects the action (`approve`, `ratify`,
`claim`, `close`, `reopen`, `park`, `block`, `unblock`, `unpark`); business logic, error codes, and
file-write behavior live in `src/tools/spec_*.ts` — this tool dispatches only.

**Shared inputs:** `{ slug, to: "approve"|"ratify"|"claim"|"close"|"reopen"|"park"|"block"|"unblock"|"unpark", commit?: boolean, dryRun?: boolean }` plus the per-action fields below.

| `to` | Transition | Extra inputs | Required | Output (in addition to `slug`) |
| ------ | ----------- | -------------- | ---------- | ------------------------------- |
| `approve` | DRAFT → APPROVED | `note?` | — | `before, after, commit_sha` |
| `ratify` | Fill Q-table TBD rows with `Ratified <DTG>` | `decisions?: {[Q_id]:{text,as_of_dtg}}`, `default_disposition?` | — | `ratified_q_count, commit_sha` |
| `claim` | DRAFT/APPROVED → IN_PROGRESS | `claimer?`, `ratify?: boolean` | — | `before, after, commit_sha, ratified_q_count` |
| `close` | IN_PROGRESS \| PARKED → DONE | `summary?`, `allow_open?: ("P0"\|"P1"\|"P2")[]`, `push?: boolean` | `summary` (or profile `summary_template`) | `before, after, commit_sha, pushed, push_error?` |
| `reopen` | DONE → IN_PROGRESS | `reason` | `reason` | `before, after, commit_sha` |
| `park` | DRAFT/APPROVED/IN_PROGRESS/BLOCKED → PARKED | `resolution` | `resolution` | `before, after, commit_sha` |
| `block` | IN_PROGRESS → BLOCKED | `reason`, `blocker_path?` | `reason` | `before, after, commit_sha` |
| `unblock` | BLOCKED → IN_PROGRESS | `resolution` | `resolution` | `before, after, commit_sha` |
| `unpark` | PARKED → IN_PROGRESS | `resolution` | `resolution` | `before, after, commit_sha` |

`before`/`after` are `{state, dtg}` for transitions that never leave `specs/active/` (`approve`,
`claim`, `block`, `unblock`) and `{state, dtg, path}` for transitions that `git mv` the spec directory
between `active/`, `done/`, and `parked/` (`close`, `reopen`, `park`, `unpark`).

**Failure modes:** `state_invalid` (illegal transition for the spec's current state — e.g. `close` from
BLOCKED requires `unblock` first), `ratify_required`, `tasks_open`, `tasks_md_missing_human_gate`,
`working_tree_dirty`, `owner_mismatch`, `spec_not_found`, `spec_not_active` (`park` on a non-`active/`
spec), `spec_not_parked` (`unpark` on a non-`parked/` spec), `reason_missing` (`reopen`/`block` with an
empty `reason`), `resolution_missing` (`park`/`unblock`/`unpark` with an empty `resolution`),
`summary_missing` (`close` with no `summary` and no profile `summary_template`).

`close` from PARKED is the "abandon parked spec" path — use when the wake trigger is permanently
obsolete; use `to: "unpark"` to wake the spec instead. `unpark` is the mirror of `park`, for when the
wake trigger fires (calendar gate, customer inbound, Phase-N ratification).

---

## Write infrastructure tools

### `spec_index_rebuild`

Regenerate `specs/README.md` from per-spec frontmatter + summaries. Used to recover from drift or baseline a fresh repo.

**Inputs:** `{}` (or empty).

**Output:** `{ active_count, done_count, parked_count, commit_sha, dryRun, rendered, scaffold_repairs: string[] }`.

**Behavior:** Creates `specs/` (the configured `spec_dir` root) if missing, then ensures `active/`, `done/`, and `parked/` exist (new buckets get an empty `.gitkeep`). Writes a **fresh** `${spec_dir}/README.md` from `renderIndex` (full three-table regenerate). Stages `README.md` plus any repaired paths when committing. `dryRun` does not touch the filesystem. Within each section, table rows are ordered by **parsed status DTG** (newest first; supports Bastion `DDHHMMZMONYY` and ISO-8601), then slug when timestamps tie.

### `spec_init`

Bootstrap fresh repo: writes `specs/config.yaml` + `specs/README.md` + `specs/active/.gitkeep` + `specs/done/.gitkeep` + `specs/parked/.gitkeep`.

**Inputs:** `{ profile: string, overrides?: object }`. `profile` is a free-form string naming any built-in (`"default"`, `"bastion"`) or a custom profile declared in `specs/config.yaml`.

**Output:** `{ created_files: string[], profile_resolved: object }`.

**Failure modes:** `config_invalid`, `path_outside_repo`, refuses if `specs/` already non-empty.
