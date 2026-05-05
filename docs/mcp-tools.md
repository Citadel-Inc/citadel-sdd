# MCP Tools

Permanent canon for: tool inventory + per-tool inputs / outputs / failure modes.

Architecture taxonomy (read / write atomic / write composite / write infrastructure) is in [docs/architecture.md § Tool taxonomy](architecture.md#tool-taxonomy).

## Common parameters

| Field | Default | Notes |
|-------|---------|-------|
| `dryRun` | `false` | Preview only — no FS writes, no commits. Returns same diff as live call. |
| `commit` | profile-default | When `false`, leaves edits staged but does not commit. |
| `push` | profile-default | Push policy: `never` / `on_close` / `always`. |
| `format` | `"json"` | `"markdown"` for human-readable rollup. |

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

**Inputs:** `{ state?: "active"|"done"|"parked"|"blocked"|"all", mine?: boolean, format?: "compact"|"table"|"json" }`. Defaults: `state="active"`, `mine=false`, `format="compact"`.

**Output:** ordered array of `{ slug, state, dtg, owner, approved_dtg, ratified, p0_remaining, p1_remaining, p2_remaining, blockers }`. Sort by DTG descending unless `mine=true` (then by remaining-task count ascending).

### `spec_read`

Return combined spec + plan + tasks for a slug.

**Inputs:** `{ slug, parts?: ("spec"|"plan"|"tasks")[] }`. Default returns all three.

**Output:** `{ slug, spec_md, plan_md, tasks_md, frontmatter }`.

### `spec_status`

Single-spec status summary.

**Inputs:** `{ slug }`.

**Output:** `{ slug, state, dtg, owner, approved_dtg, ratified, q_table: [{id, question, default, ratified_at}], task_counts: { p0:{open,done}, p1:{...}, p2:{...} }, blockers, last_commit_sha }`.

### `spec_lint`

Run strict-mode validation. Wraps the TypeScript port of archived `spec-status.py`.

**Inputs:** `{ slug?, include_done?: boolean, include_parked?: boolean }`. Without slug, lints the whole tree. Default scans `specs/active/` only; `include_done` adds `specs/done/`; `include_parked` adds `specs/parked/` (flags compose). Per-spec `slug` lint resolves the slug wherever it lives.

**Output:** `{ findings: [{severity, message, path, slug?}], exit_code }`. Exit-code parity with archived Python script is enforced ([D-4](decisions.md)).

### `sdd_doctor`

Diagnose existing repo, infer best-match profile, flag drift.

**Inputs:** `{}` (or empty).

**Output:** `{ inferred_profile, findings: [{severity, message, path}], drift: boolean, recommendations: string[] }`.

Runs `spec_lint` with `include_done: true` and `include_parked: true` so parked and archived specs participate in the health rollup.

---

## Write atomic tools

### `spec_approve`

DRAFT → APPROVED. Sole legal use; all other transitions covered by composites.

**Inputs:** `{ slug, note? }`.

**Output:** `{ slug, before, after, commit_sha }`.

**Behavior:** flip status, append history row, conventional commit `spec(<slug>): APPROVED — <note?>`.

### `spec_ratify`

Replace `TBD` rows in Q-table with `Ratified <DTG>`.

**Inputs:** `{ slug, decisions?: { [Q_id]: { text, as_of_dtg } }, default_disposition?: string }`.

**Output:** `{ slug, ratified_q_count, commit_sha }`.

Empty `decisions` + default `Ratified <DTG>` = bulk ratify (common case).

### `spec_task_check`

Flip a single `tasks.md` checkbox.

**Inputs:** `{ slug, phase: "P0"|"P1"|"P2", match: string|number, checked: boolean }`. `match` is exact-match prefix or 1-based index within phase.

**Output:** `{ slug, before, after, commit_sha }`.

### `spec_task_add`

Append a checklist item to a phase.

**Inputs:** `{ slug, phase, text, blocker?: boolean }`.

**Output:** `{ slug, added_index, commit_sha }`.

### `spec_handoff`

Reassign owner without state flip.

**Inputs:** `{ slug, new_owner, note? }`.

**Output:** `{ slug, before_owner, after_owner, commit_sha }`.

---

## Write composite tools

### `spec_claim`

DRAFT/APPROVED → IN_PROGRESS + optional ratify + commit.

**Inputs:** `{ slug, claimer?, ratify?: boolean, seed_session_tasks?: boolean, commit?: boolean, dryRun?: boolean }`. `claimer` defaults to `"Bastion"` for bastion-chain profiles, `git config user.name` otherwise.

**Output:** `{ slug, before, after, commit_sha, ratified_q_count, seeded_task_proposals?: [...] }`.

**Failure modes:** `state_invalid`, `ratify_required`, `tasks_md_missing_human_gate`, `working_tree_dirty`, `owner_mismatch`.

### `spec_close`

IN_PROGRESS → DONE + `git mv` active→done + `specs/README.md` index splice + commit + optional push.

**Inputs:** `{ slug, summary, allow_open?: ("p0"|"p1"|"p2")[], commit?: boolean, push?: boolean, dryRun?: boolean }`. `push` defaults to profile's `push_policy`.

**Output:** `{ slug, before:{state,dtg,path}, after:{state,dtg,path}, commit_sha, pushed: boolean, readme_diff: string }`.

**Failure modes:** `state_invalid`, `tasks_open`, `working_tree_dirty`, `summary_missing`.

### `spec_park`

DRAFT/APPROVED/IN_PROGRESS/BLOCKED → PARKED + `git mv` active→`specs/parked/` + `specs/README.md` index splice + commit.

**Inputs:** `{ slug, resolution, commit?: boolean, dryRun?: boolean }`. `resolution` is required (non-empty); recorded in status tail and `## History`.

**Output:** `{ slug, before:{state,dtg,path}, after:{state,dtg,path}, commit_sha, dryRun }`.

**Failure modes:** `state_invalid`, `spec_not_found`, `spec_not_active` (slug not under `specs/active/`), `resolution_missing`, `working_tree_dirty` (when applicable).

### `spec_reopen`

DONE → IN_PROGRESS + reverse `git mv` + index splice + commit.

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

---

## Write infrastructure tools

### `spec_index_rebuild`

Regenerate `specs/README.md` from per-spec frontmatter + summaries. Used to recover from drift or baseline a fresh repo.

**Inputs:** `{}` (or empty).

**Output:** `{ active_count, done_count, parked_count, commit_sha, dryRun, rendered }`.

### `spec_init`

Bootstrap fresh repo: writes `specs/config.yaml` + `specs/README.md` + `specs/active/.gitkeep` + `specs/done/.gitkeep` + `specs/parked/.gitkeep`.

**Inputs:** `{ profile: "default"|"bastion"|"citadel"|"custom", overrides?: object }`.

**Output:** `{ created_files: string[], profile_resolved: object }`.

**Failure modes:** `config_invalid`, `path_outside_repo`, refuses if `specs/` already non-empty.
