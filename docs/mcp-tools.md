# MCP Tools

Permanent canon for: tool inventory + per-tool inputs / outputs / failure modes.

Architecture taxonomy (read / write atomic / write composite / write infrastructure) is in [docs/architecture.md § Tool taxonomy](architecture.md#tool-taxonomy).

## Common parameters

| Field | Default | Notes |
|-------|---------|-------|
| `workspaceRoot` | first MCP file root | Highest-priority project-root override. Usually omit it: MCP clients that support roots provide the active workspace automatically. |
| `rootIndex` | `0` | 0-based index into the MCP file roots list; ignored when `workspaceRoot` is set. Useful in multi-root clients. |
| `dryRun` | `false` | Preview only — no FS writes, no commits. Returns same diff as live call. |
| `commit` | profile-default | When `false`, leaves edits staged but does not commit. |
| `push` | profile-default | Push policy: `never` / `on_close` / `always`. |
| `format` | `"json"` | `"markdown"` for human-readable rollup. |

All tools resolve their project root at call time from `workspaceRoot`, `rootIndex`, MCP client roots, then process fallback. The fallback still honors `CITADEL_SDD_ROOT` for clients that do not support MCP roots, but normal client wiring does not require an environment variable.

## Common failure codes

| Code | Trigger |
|------|---------|
| `state_invalid` | Requested transition not legal per [docs/architecture.md § State machine](architecture.md#state-machine). |
| `slug_collision` | Slug already used under `active/`, `done/`, or `parked/`. Slugs are unique forever ([D-9](decisions.md)). |
| `slug_invalid` | Slug fails canonical pattern (lowercase kebab-case, no path separators). |
| `working_tree_dirty` | Unrelated dirty paths in tree; commit refused unless `--allow-dirty`. |
| `ratify_required` | Q-table has `TBD` rows and `ratify=false`. |
| `tasks_open` | `spec_close` called with unchecked checkboxes outside `allow_open` whitelist. |
| `path_outside_repo` | Input path escapes `git rev-parse --show-toplevel`. Refused. |
| `profile_chain_broken` | `extends:` references unknown profile or forms a cycle. |
| `config_invalid` | `specs/config.yaml` fails schema validation. |
| `owner_mismatch` | `spec_claim` against IN_PROGRESS spec held by a different owner. |

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

**Output:** `{ slug, spec_md, plan_md, tasks_md, frontmatter }`.

### `spec_status`

Single-spec status summary.

**Inputs:** `{ slug, recent_limit?: number, since?: string }`. `recent_limit` caps the number of history rows returned. `since` is an ISO-8601 or Bastion DTG string; only history entries at or after that timestamp are included.

**Output:** `{ slug, state, dtg, owner, approved_dtg, ratified, q_table: [{id, question, default, ratified_at}], task_counts: { p0:{open,done}, p1:{...}, p2:{...} }, blockers, last_commit_sha }`.

### `spec_lint`

Run strict-mode validation. Wraps the TypeScript port of archived `spec-status.py`.

**Inputs:** `{ slug?, include_done?: boolean, include_parked?: boolean, no_strict?: boolean, fail_on?: string[]|"all", roots?: string[], scan_nested?: { parent: string, depth?: number }, stale_days?: number }`. Without slug, lints the whole tree. Default scans `specs/active/` only; `include_done` adds `specs/done/`; `include_parked` adds `specs/parked/` (flags compose). Per-spec `slug` lint resolves the slug wherever it lives. `no_strict` disables strict-mode rules. `fail_on` sets which rule codes (or `"all"`) cause a non-zero exit. `roots` overrides the set of spec-tree roots to lint. `scan_nested` walks `parent` up to `depth` levels looking for nested spec trees. `stale_days` overrides the profile default for stale-spec detection.

**Output:** `{ findings: [{severity, message, path, slug?}], exit_code }`. Exit-code parity with archived Python script is enforced ([D-4](decisions.md)).

### `sdd_doctor`

Diagnose existing repo, infer best-match profile, flag drift.

**Inputs:** `{}` (or empty).

**Output:** `{ inferred_profile, findings: [{severity, message, path}], drift: boolean, recommendations: string[], scaffold_repairs: string[] }`. `scaffold_repairs` lists repo-relative paths created when missing `specs/<active|done|parked>/` buckets were repaired (empty `.gitkeep` in new dirs); empty when the layout was already complete.

Runs `spec_lint` with `include_done: true` and `include_parked: true` so parked and archived specs participate in the health rollup. Does not create `specs/` itself when absent (use `spec_init`).

---

### `specs/README.md` index edits

Only **`spec_init`** and **`spec_index_rebuild`** perform a **full** rewrite of `${spec_dir}/README.md` via `renderIndex`. Every other tool that touches the index (`spec_claim`, `spec_approve`, `spec_block`, `spec_unblock`, `spec_handoff`, `spec_close`, `spec_park`, `spec_unpark`, `spec_reopen`) applies **targeted** edits through `src/spec/spec_readme.ts`: locate each section’s machine table header (`| Slug | State | DTG | Owner |` or `| Slug | DTG | Note |`) and separator, remove the slug from all three tables, restore `| _(none)_ |` placeholders when a table becomes empty, then insert the fresh row **immediately after the separator** in the destination bucket (first data row). Content after the Parked table (for example a trailing `## Notes`) is preserved. **Ordering:** partial updates move only the touched slug to the top of its bucket; **full** chronological sort of every row in every table is restored only by **`spec_index_rebuild`**. If the file is missing expected headings or headers, writers throw `readme_unparseable` — run **`spec_index_rebuild`** (or **`spec_init`** on a fresh tree).

---

## Write atomic tools

### `spec_approve`

DRAFT → APPROVED. Sole legal use; all other transitions covered by composites.

**Inputs:** `{ slug, note? }`.

**Output:** `{ slug, before, after, commit_sha }`.

**Behavior:** flip status, append history row, targeted `${spec_dir}/README.md` row update, conventional commit `spec(<slug>): APPROVED — <note?>`.

### `spec_ratify`

Replace `TBD` rows in Q-table with `Ratified <DTG>`.

**Inputs:** `{ slug, decisions?: { [Q_id]: { text, as_of_dtg } }, default_disposition?: string }`.

**Output:** `{ slug, ratified_q_count, commit_sha }`.

Empty `decisions` + default `Ratified <DTG>` = bulk ratify (common case).

### `spec_task_check`

Flip a single `tasks.md` checkbox.

**Inputs (single-item form):** `{ slug, phase: "P0"|"P1"|"P2", match: string|number, checked: boolean }`. `match` is exact-match prefix or 1-based index within phase.

**Inputs (batch form):** `{ slug, items: [{ phase: "P0"|"P1"|"P2", match: string|number, checked: boolean }] }`. Check or uncheck multiple items in one call; applied in order.

**Output:** `{ slug, before, after, commit_sha }`.

### `spec_task_add`

Append a checklist item to a phase.

**Inputs:** `{ slug, phase, text, blocker?: boolean }`.

**Output:** `{ slug, added_index, commit_sha }`.

### `spec_handoff`

Reassign owner without state flip.

**Inputs:** `{ slug, new_owner, note? }`.

**Output:** `{ slug, before_owner, after_owner, commit_sha }`. Updates the Active table row in `${spec_dir}/README.md` when committing.

---

## Write composite tools

### `spec_claim`

DRAFT/APPROVED → IN_PROGRESS + optional ratify + commit.

**Inputs:** `{ slug, claimer?, ratify?: boolean, seed_session_tasks?: boolean, commit?: boolean, dryRun?: boolean }`. `claimer` defaults to `"Bastion"` for bastion-chain profiles, `git config user.name` otherwise.

**Output:** `{ slug, before, after, commit_sha, ratified_q_count, seeded_task_proposals?: [...] }`.

**Failure modes:** `state_invalid`, `ratify_required`, `tasks_md_missing_human_gate`, `working_tree_dirty`, `owner_mismatch`.

### `spec_close`

IN_PROGRESS or PARKED → DONE + `git mv` active|parked→done + targeted `${spec_dir}/README.md` row update + commit + optional push. Closing from PARKED is the "abandon parked spec" path — use when the wake trigger is permanently obsolete; use [`spec_unpark`](#spec_unpark) to wake the spec instead.

**Inputs:** `{ slug, summary, allow_open?: ("p0"|"p1"|"p2")[], commit?: boolean, push?: boolean, dryRun?: boolean }`. `push` defaults to profile's `push_policy`.

**Output:** `{ slug, before:{state,dtg,path}, after:{state,dtg,path}, commit_sha, pushed: boolean, dryRun: boolean }`.

**Failure modes:** `state_invalid` (e.g. BLOCKED — run `spec_unblock` first; DRAFT/APPROVED — claim or park first), `tasks_open`, `working_tree_dirty`, `summary_missing`.

### `spec_park`

DRAFT/APPROVED/IN_PROGRESS/BLOCKED → PARKED + `git mv` active→`specs/parked/` + targeted `${spec_dir}/README.md` row update + commit.

**Inputs:** `{ slug, resolution, commit?: boolean, dryRun?: boolean }`. `resolution` is required (non-empty); recorded in status tail and `## History`.

**Output:** `{ slug, before:{state,dtg,path}, after:{state,dtg,path}, commit_sha, dryRun }`.

**Failure modes:** `state_invalid`, `spec_not_found`, `spec_not_active` (slug not under `specs/active/`), `resolution_missing`, `working_tree_dirty` (when applicable).

### `spec_reopen`

DONE → IN_PROGRESS + reverse `git mv` + targeted `${spec_dir}/README.md` row update + commit.

**Inputs:** `{ slug, reason }`.

**Output:** `{ slug, before, after, commit_sha }`.

### `spec_block`

IN_PROGRESS → BLOCKED + reason + optional `HUMAN_BLOCKERS.md` row.

**Inputs:** `{ slug, reason, blocker_path? }`.

**Output:** `{ slug, before, after, commit_sha }`.

### `spec_unblock`

BLOCKED → IN_PROGRESS + reason close.

**Inputs:** `{ slug, resolution }`.

**Output:** `{ slug, before, after, commit_sha }`.

### `spec_unpark`

PARKED → IN_PROGRESS + reverse `git mv` parked→active + targeted `${spec_dir}/README.md` row update + commit. Mirror of `spec_park`; use when the parked wake trigger fires (calendar gate, customer inbound, Phase-N ratification).

**Inputs:** `{ slug, resolution, commit?: boolean, dryRun?: boolean }`. `resolution` is required and recorded in the status tail (`unparked — <resolution>`).

**Output:** `{ slug, before:{state,dtg,path}, after:{state,dtg,path}, commit_sha, dryRun }`.

**Failure modes:** `state_invalid` (spec not PARKED), `spec_not_found`, `resolution_missing`, `working_tree_dirty`.

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
