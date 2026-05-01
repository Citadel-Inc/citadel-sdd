# PRD — `citadel-sdd` MCP server

| | |
|---|---|
| Status | **DRAFT 011920ZMAY26** — authored from retrospective findings during the 2026-05-01 citadel session. |
| Audience | The next agent who picks this up. Assume zero session continuity. |
| Position | Sibling of `Rethunk-Tech/citadel` at `/usr/local/src/com.github/Rethunk-Tech/citadel-sdd/`. Standalone repo / workspace. |
| Consumes | The `Rethunk-Tech/citadel` repo's `specs/` tree + `docs/specs.md` discipline. |
| Authoring rationale | See § Origin — five-spec session showed ~15 mechanical tool calls per spec lifecycle were pure ceremony. Wrap them. |

---

## 1. Mission

`citadel-sdd` is a self-hosted MCP server that wraps the citadel **Spec-Driven Development** lifecycle. It replaces ~15 hand-edited Edit/Write/git-mv tool calls per spec with a small set of atomic MCP tools that an agent (Bastion / Claude Code) can invoke once. Goals, in priority order:

1. **Reduce ceremony.** Spec claim, spec close, README index splice, status flips, Q-table ratification — these are 100% mechanical and should never consume an LLM's planning budget.
2. **Eliminate drift.** The `specs/README.md` index, per-spec status lines, and `tasks.md` Q-gate checkbox are three places that hold the same fact and *must agree*. The MCP atomically writes them as a unit.
3. **Be discoverable.** Bastion finds active specs, claimed specs, and unclaimed approved specs without having to `ls` and `grep` per session start.
4. **Fail loud.** Lint-out invalid state transitions (DONE → DRAFT, double-claim, claim-while-blocked) before they corrupt the tree.
5. **Co-exist.** Doesn't replace `docs/specs.md` (the human-readable canon) or `/spec-status` (the existing pure-Python lint). Sits alongside both.

Non-goals:
- Spec authoring assistance (LLM still drafts spec.md / plan.md / tasks.md).
- Replacing git or the deploy pipeline. The MCP can *trigger* commits but doesn't replace `mcp__rethunk-git__batch_commit`.
- Multi-repo support at v1. Citadel-only. The wrapper architecture *should* generalise — see § 9 — but v1 hard-codes the path.

---

## 2. Origin (why this exists)

Retrospective from a five-spec session (2026-05-01) found:

- Per-spec ceremony averaged ~15 tool calls (status flips, ratify-table edits, README splices, git-mv, close commits). Multiply by five specs = ~75 calls of pure mechanical work.
- The `specs/README.md` done-row was hand-authored each close as a wall-of-text summary; both error-prone and slow.
- `AskUserQuestion` ratify gates were boilerplate ("ratify all" yes/no) that the user always answers the same way; the gate had no value when the spec defaults were explicit.
- Migration application was a recurring gap (Supabase MCP read-only, hand-shell to `supabase db push`); affected three specs with substrate changes during the session.
- Cwd persistence between Bash calls was misdocumented in `~/.claude/CLAUDE.md`, causing intermittent path failures.
- `mcp__rethunk-git__batch_commit` quietly swept untracked files into commits, mixing attribution.

The first three items are the direct fit for an MCP wrapper; the rest are doc updates (already applied, see § 11.A).

---

## 3. Tool inventory

Each tool below is an atomic operation. Tools 3.1 – 3.7 are the originally-named set; 3.8 – 3.16 are non-overlapping additions that surfaced during PRD authoring.

| # | Tool | Class | Purpose |
|---|------|-------|---------|
| 3.1 | `spec_list` | Read | List specs by state (active / done / blocked / all). |
| 3.2 | `spec_read` | Read | Return combined spec.md + plan.md + tasks.md for a slug. |
| 3.3 | `spec_status` | Read | Return parsed status of a single spec (state + DTG + ratify-state + task counts). |
| 3.4 | `spec_claim` | Write | Atomic DRAFT/APPROVED → IN_PROGRESS flip (+ ratify table, + tasks.md gate, + commit). |
| 3.5 | `spec_close` | Write | Atomic IN_PROGRESS → DONE flip (+ tasks flip, + active→done move, + README splice, + commit). |
| 3.6 | `spec_reopen` | Write | Atomic DONE → IN_PROGRESS flip (+ done→active move, + README splice). |
| 3.7 | `spec_ratify` | Write | Replace `TBD` rows in the decision log with `Ratified <DTG>`. |
| 3.8 | `spec_status_set` | Write | Lower-level: flip status to any valid state (used internally by claim/close). |
| 3.9 | `spec_index_rebuild` | Write | Regenerate `specs/README.md` from per-spec frontmatter. |
| 3.10 | `spec_lint` | Read | Run `/spec-status --strict` style validation; return findings. |
| 3.11 | `spec_block` | Write | Mark a spec BLOCKED with reason + HUMAN_BLOCKERS pointer. |
| 3.12 | `spec_unblock` | Write | Reverse `spec_block`. |
| 3.13 | `spec_task_check` | Write | Flip a `tasks.md` checkbox `[ ]` → `[x]` (or vice versa). |
| 3.14 | `spec_task_add` | Write | Append a checklist item to a phase. |
| 3.15 | `spec_handoff` | Write | Stamp owner change into spec.md (multi-agent collaboration). |
| 3.16 | `spec_diff_summary` | Read | Return git log + file-changed summary scoped to a spec's paths since claim. |

Tools 3.4 – 3.7 + 3.9 + 3.11 – 3.15 produce a commit by default; all writes accept `dryRun: true` for preview.

### 3.1 `spec_list`

**Inputs:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `state` | `"active" \| "done" \| "blocked" \| "all"` | `"active"` | |
| `mine` | `boolean` | `false` | Filter to specs whose Owner field matches the caller's principal (configurable, see § 7). |
| `format` | `"compact" \| "table" \| "json"` | `"compact"` | |

**Output:** ordered array of `{slug, state, dtg, owner, approved_dtg, ratified, p0_remaining, p1_remaining, p2_remaining, blockers}`. Sort by DTG descending unless `mine` is true (then by remaining-task count ascending — easiest finishes first).

**Example:**
```json
[
  {"slug": "fe-account-export", "state": "DRAFT", "dtg": "010340ZMAY26", "owner": "Bastion (J-3)", "ratified": false, "p0_remaining": 8, "p1_remaining": 5, "p2_remaining": 4, "blockers": []},
  {"slug": "go-mcp-oauth", "state": "APPROVED", "dtg": "300012ZAPR26", "approved_dtg": "300027ZAPR26", "ratified": true, "p0_remaining": 0, "p1_remaining": 4, "p2_remaining": 2, "blockers": []}
]
```

### 3.2 `spec_read`

**Inputs:** `{ slug: string, parts?: ("spec" | "plan" | "tasks")[] }`. Default returns all three.

**Output:** `{ slug, spec_md, plan_md, tasks_md, frontmatter: { status, dtg, owner, ... } }`. Frontmatter parsed from the `| Status | … |` header table at the top of `spec.md`.

### 3.3 `spec_status`

**Inputs:** `{ slug: string }`.

**Output:** `{ slug, state, dtg, owner, approved_dtg, ratified, q_table: [{ id, question, default, ratified_at }], task_counts: {p0: {open, done}, p1: {...}, p2: {...}}, blockers, last_commit_sha }`.

### 3.4 `spec_claim`

The big one. Atomically:

1. Verifies spec is `DRAFT` or `APPROVED` (refuses `IN_PROGRESS`, `DONE`, `BLOCKED`).
2. Optionally ratifies the Q-table (when `ratify: true`).
3. Edits `spec.md`:
   - `| Status | DRAFT <oldDTG> ... |` → `| Status | IN_PROGRESS <freshDTG> — <claimer> claims execution; Q1-Q<n> ratified |`.
   - `| TBD |` → `| **Ratified <freshDTG>** |` (only when `ratify: true`).
4. Edits `tasks.md`:
   - Status line flip.
   - Check the `- [ ] [HUMAN] NOMAD ratifies …` first item (when `ratify: true`).
5. `git add` the two edited files; emit a conventional commit `spec(<slug>): IN_PROGRESS — <claimer> claims; Q1-Q<n> ratified`.
6. Optionally invokes `task_seed_from_tasks_md` (see § 4) so the agent's session-task list mirrors the spec's checklist.

**Inputs:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `slug` | `string` | required | |
| `claimer` | `string` | `"Bastion"` | Free text; goes into the status line. |
| `ratify` | `boolean` | `true` | When true, replaces all `TBD` Q-rows. When false, fails if any `TBD` row exists in the Q-table. |
| `seed_session_tasks` | `boolean` | `false` | Call out to the harness's TaskCreate to mirror tasks.md (see § 4). |
| `commit` | `boolean` | `true` | When false, leaves edits staged but does not commit. |
| `dryRun` | `boolean` | `false` | Preview only. |

**Output:** `{ slug, before: {state, dtg}, after: {state, dtg}, commit_sha, ratified_q_count, seeded_task_ids }`.

**Failure modes:**
- `state_invalid` — already IN_PROGRESS / DONE / BLOCKED.
- `ratify_required` — TBD rows exist and `ratify=false`.
- `tasks_md_missing_human_gate` — first P0 row isn't the canonical `[HUMAN] NOMAD ratifies …` shape.
- `working_tree_dirty` — git tree has unrelated dirty files (mirrors the `batch_commit` over-stage problem; refuse to commit unless `--allow-dirty`).

### 3.5 `spec_close`

Atomically:

1. Verifies spec is `IN_PROGRESS`.
2. Verifies all P0 / P1 / P2 checkboxes are checked (configurable — `--allow-open p2` lets P2 ride forward).
3. Edits `spec.md`: status → `DONE <freshDTG> — <summary-tail>`.
4. Rewrites `tasks.md`: status line + flip any remaining `[ ]` to `[x]`.
5. `git mv specs/active/<slug> specs/done/<slug>`.
6. Generates the done-row for `specs/README.md` from `spec.md` frontmatter + the `summary` argument; splices in (top of Done table) and removes the active row.
7. Conventional commit `spec(<slug>): DONE <DTG> — close + index move`.
8. Optionally pushes (`commit_and_push: true`, default).

**Inputs:**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `slug` | `string` | required | |
| `summary` | `string` | required | One-paragraph wall-of-text for the README done-row. |
| `allow_open` | `("p0" \| "p1" \| "p2")[]` | `[]` | Bypass the all-checked guard for these phases. |
| `commit` | `boolean` | `true` | |
| `push` | `boolean` | `false` | |
| `dryRun` | `boolean` | `false` | |

**Output:** `{ slug, before: {state, dtg, path}, after: {state, dtg, path}, commit_sha, pushed: bool, readme_diff: <unified-diff string> }`.

**Failure modes:**
- `state_invalid`, `tasks_open` (with phase + count), `working_tree_dirty`, `summary_missing`.

### 3.6 `spec_reopen`

Reverse of close. Used when a closed spec needs more work (e.g., regression spotted post-deploy).

**Inputs:** `{ slug, reason }`.
**Output:** `{ slug, before, after, commit_sha }`.
**Behavior:** path move done→active, status flip DONE → IN_PROGRESS, README splice (active table + remove done row), conventional commit `spec(<slug>): REOPEN — <reason>`.

### 3.7 `spec_ratify`

Replaces every `TBD` row in the spec's Q-table with `Ratified <freshDTG>`. Optionally takes a per-question override map for partial ratify with deviations:

```json
{
  "slug": "go-anti-squat",
  "decisions": {
    "Q3": {"text": "Ratified-with-deviation 011920ZMAY26: severity-tagged denylist scope reduced to block + warn (no review tier in v1).", "as_of_dtg": "011920ZMAY26"}
  },
  "default_disposition": "Ratified <DTG>"
}
```

`default_disposition` covers any `TBD` rows not explicitly listed in `decisions`. Empty `decisions` + default = bulk ratify (the common case).

### 3.8 `spec_status_set`

Lower-level: flip status to any valid state. Used internally by claim/close/reopen/block; exposed for one-off corrections (e.g., fixing a manually-edited spec with a typo'd state).

States: `DRAFT`, `APPROVED`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Validates transitions per § 5; refuses invalid ones.

### 3.9 `spec_index_rebuild`

Regenerates `specs/README.md` from scratch by walking `specs/active/*/spec.md` + `specs/done/*/spec.md`, parsing each frontmatter table + first-paragraph summary, and emitting the canonical README shape. Used to recover from a hand-edit drift, or to baseline a fresh repo.

### 3.10 `spec_lint`

Wraps the existing `/spec-status --strict` Python script (currently at `~/.claude/skills/spec-status/scripts/spec-status.py`). Returns findings as JSON instead of stdout text. Same rules per `docs/specs.md § Canonical conventions`.

### 3.11 `spec_block`

Mark a spec `BLOCKED`. Inputs: `{ slug, reason, blocker_path? }` where `blocker_path` is an optional pointer into `HUMAN_BLOCKERS.md`. Edits status line, prepends a `## Blocking` section to `spec.md`, optionally writes a `HUMAN_BLOCKERS.md` row.

### 3.12 `spec_unblock`

Reverse of `spec_block`. Removes the `## Blocking` section, status flips back to whatever it was before block (tracked via a sidecar `.bastion-state.json` or via the Status table's history rows; v1: just flip to `IN_PROGRESS` and let the agent fix if needed).

### 3.13 `spec_task_check`

Flip a single `tasks.md` checkbox by phase + index, or by exact-match prefix. Inputs: `{ slug, phase: "P0"|"P1"|"P2", match: string|number, checked: boolean }`. Used during long execution loops so the agent doesn't have to Edit-replace each line.

### 3.14 `spec_task_add`

Append a new checklist item to a phase. Used when scope discovers a sub-task that wasn't in the original tasks.md. Inputs: `{ slug, phase, text, blocker?: boolean }`.

### 3.15 `spec_handoff`

Multi-agent collaboration: change the spec's owner without flipping state. Inputs: `{ slug, new_owner, note? }`. Edits the owner row + optionally appends a note to a `## Handoff` section in `spec.md`.

### 3.16 `spec_diff_summary`

Returns git-log + diff-stat scoped to a spec. Walks `git log --since=<claim DTG> -- specs/<state>/<slug>/ <inferred-paths-from-spec>` to surface what landed under the spec's umbrella. Useful for SITREP authoring + the `summary` argument to `spec_close`.

---

## 4. Optional harness integration

The MCP server is harness-agnostic, but two integrations sharply improve the experience when called from Claude Code:

1. **TaskCreate seeding.** When `spec_claim` runs with `seed_session_tasks: true`, it returns a list of tasks the harness should create. The MCP itself does not call TaskCreate (that's the harness's surface); it just emits the proposed tasks.

   ```json
   "seeded_task_proposals": [
     {"subject": "A1. Migration columns", "description": "contact_inquiries.{auto_reply_opted_out, auto_reply_message_id} + support_threads.source_inquiry_id"},
     {"subject": "A2. autoreply.go helper", "description": "..."},
     ...
   ]
   ```

   The agent then loops through `TaskCreate` to materialise.

2. **AskUserQuestion suppression.** When the spec's Q-table is fully `TBD`, the harness wraps `spec_claim` in a single yes/no AskUserQuestion. When the Q-table is fully `Ratified`, the harness skips the question and proceeds. The decision rule lives in the harness, not the MCP — but the MCP returns enough metadata (`ratified: false`) for the harness to make the decision.

---

## 5. Valid state transitions

```
DRAFT ──────► APPROVED ──────► IN_PROGRESS ──────► DONE
   │              │                  │
   │              │                  ├───► BLOCKED ──► IN_PROGRESS
   │              │
   └──────────────┴──► IN_PROGRESS (claim from DRAFT, skipping APPROVED, is allowed when claimer = author)
                                              ▲
                                              │
                                       DONE ──┘ (reopen)
```

- Skipping APPROVED is permitted when the claimer is the spec's authored Owner (single-agent flow).
- BLOCKED is reachable only from IN_PROGRESS.
- DRAFT → DONE direct is invalid (must go through IN_PROGRESS).
- DONE → DRAFT is invalid (use `spec_reopen` → IN_PROGRESS, then iterate).

---

## 6. File-system contracts

The MCP reads / writes these paths under the configured `repo_root`:

| Path | Read / Write | Notes |
|------|--------------|-------|
| `specs/active/<slug>/spec.md` | RW | Top-of-file `\| Status \| … \|` table is the canonical state. |
| `specs/active/<slug>/plan.md` | R | Read-only from MCP perspective; edited by humans + agents. |
| `specs/active/<slug>/tasks.md` | RW | Status line + checkbox state. |
| `specs/done/<slug>/{spec,plan,tasks}.md` | RW | Same shapes; just lives under `done/`. |
| `specs/README.md` | RW | Two-table index — active + done. The done-row is auto-generated; the active-row is a short description copied from the spec's summary line. |
| `HUMAN_BLOCKERS.md` | RW | Optional; created on first `spec_block` if absent. |
| `docs/specs.md` | R (only) | Discipline canon; never written by MCP. |

**Invariants the MCP enforces on every write:**
1. Status table on `spec.md` matches status line on `tasks.md`.
2. The spec's directory location matches its state (active/ for non-DONE, done/ for DONE).
3. The `specs/README.md` index exactly mirrors the on-disk specs (no orphan rows; no missing rows).
4. Conventional-commit subject for every commit-emitting tool.
5. Deterministic file ordering (sort `Object.keys`, sort entries) so re-rendering produces stable diffs.

---

## 7. Authentication / authorization

V1 is **local-only**. The MCP runs on the agent's machine, exposes its endpoint over a Unix socket or `localhost:NNNN`, and trusts everything that connects.

V2 (when needed):
- Bearer token from a known agent_token (citadel auth model already supports this).
- Per-tool permission atoms: `spec:read`, `spec:write`, `spec:claim`, `spec:close` — mirrors citadel's RBAC.
- A "principal" → "claimer" mapping so `spec_list --mine` works in multi-agent setups.

---

## 8. Implementation language + boilerplate

**Recommendation: Go.**

- Citadel itself is Go; staffing alignment matters.
- The MCP transport (Streamable HTTP per protocol `2025-11-25`) has good Go libraries (e.g. `github.com/modelcontextprotocol/go-sdk` if available, otherwise hand-roll the JSON-RPC envelope — the surface is small).
- File I/O + git shell-out is fastest in Go without ceremony.
- Sibling repos (`bastion-*`) are mostly Go; this slots in.

Alternative: TypeScript (Node 22+).
- Faster prototyping.
- MCP SDK in TypeScript is mature.
- Cost: another ecosystem in Rethunk-Tech's repo set.

**File layout (Go):**

```
citadel-sdd/
├── README.md                    # human-facing, points at PRD
├── PRD.md                       # this file
├── go.mod / go.sum
├── cmd/citadel-sdd/main.go      # MCP server entrypoint
├── internal/spec/
│   ├── parse.go                 # frontmatter + Q-table + tasks.md parser
│   ├── render.go                # canonical render of spec.md / tasks.md / README
│   ├── transitions.go           # state machine
│   ├── lint.go                  # spec_lint
│   └── git.go                   # commit / push wrappers (shell out; reuse rethunk-git semantics)
├── internal/mcp/
│   ├── server.go                # JSON-RPC dispatch
│   ├── tools.go                 # tool definitions (per § 3)
│   └── schemas.go               # JSONSchema for each tool's input
├── internal/config/
│   └── config.go                # repo_root resolution (env CITADEL_SDD_ROOT or autodetect)
├── testdata/
│   ├── spec-fixtures/           # canonical / corrupt / edge-case spec dirs
│   └── golden/                  # expected post-edit file states
└── scripts/
    └── install.sh               # add server to ~/.claude/mcp_servers.json
```

**External tools used by Go (shell-out path):**
- `git` for the move + commit + push (or `mcp__rethunk-git__*` if exposed in-process; cleanest is direct git).
- `python3 ~/.claude/skills/spec-status/scripts/spec-status.py --strict` for `spec_lint` (don't reimplement the lint; wrap it).

---

## 9. Generalisation hook

Although v1 is citadel-only, the entire surface is just three things:

1. A `repo_root` path with a `specs/active/`, `specs/done/`, `specs/README.md` shape.
2. A status-line format (`| Status | <STATE> <DTG> — <tail> |`).
3. A Q-table format (`| # | Question | Proposed default | NOMAD |`).

If those shapes ever change (or another Rethunk repo adopts SDD), the MCP can be reconfigured via a `~/.config/citadel-sdd/profiles.toml` file with per-profile path glob + parser overrides. Out of scope for v1; design with `profile string` accepted on every tool but ignored.

---

## 10. Testing strategy

- **Unit:** `internal/spec/*_test.go` — parser round-trips on all 30+ existing specs in citadel's tree (good and bad). Render-then-parse must be idempotent.
- **Golden:** `testdata/golden/` snapshots of `spec_claim` / `spec_close` output for known fixtures. Diffs land in code review.
- **Integration:** spin up a temp git repo from `testdata/spec-fixtures/`, run each tool end-to-end, assert resulting tree + commit log shape.
- **Citadel parity:** a CI step that runs `spec_lint` against the live citadel tree must stay green at every commit. (Imports the citadel repo via git submodule or shallow clone in CI; doesn't share the working tree.)
- **Drift test:** for each tool, after-state must equal a hand-rolled before+after fixture; diffs must be reviewed not auto-accepted.

---

## 11. Open questions / decision log

| # | Question | Default |
|---|----------|---------|
| Q1 | Repo path discovery | env `CITADEL_SDD_ROOT`, falling back to `git rev-parse --show-toplevel` if it contains a `specs/` dir, falling back to `/usr/local/src/com.github/Rethunk-Tech/citadel`. |
| Q2 | Commit author identity | Reuse `mcp__rethunk-git__batch_commit` semantics (`Bastion Agent` or env-driven). |
| Q3 | Auto-push on close | **Default off**; opt-in via `push: true`. NOMAD's existing C10 canon authorises push, but explicit beats implicit for an MCP. |
| Q4 | DTG source of truth | Always `time.Now().UTC()` formatted as `DDHHMMZMONYY`. Never accept caller-supplied DTG. |
| Q5 | Q-table parser strictness | Accept the canonical shape only (`\| # \| Question \| Proposed default \| NOMAD \|`). Lint-fail on any deviation. |
| Q6 | Lint integration | Wrap the existing Python `spec-status` script via shell-out. Do **not** reimplement; the script is the canon. |
| Q7 | Atomicity guarantee | All-or-nothing per tool: if any step fails, the working tree is restored to the pre-call state via a save-and-restore over the affected files (no partial state). Achieved by buffering edits in memory, then writing all files in one pass, then committing — if any fails, write the originals back. |
| Q8 | README done-row generation | Build from spec.md frontmatter + `summary` argument, NOT from a hand-edited blob. The hand-edited blob is the reason this PRD exists. |
| Q9 | Multi-claimer collision | Refuse `spec_claim` if the spec is already IN_PROGRESS with a different `owner`. The harness should call `spec_status` first when uncertain. |
| Q10 | History preservation on REOPEN | Append a `## History` section row to `spec.md` recording each state transition + DTG + actor. Survives close→reopen→close cycles. |

Each question lands in the spec's own decision log when the project ratifies. NOMAD ratify expected before implementation begins.

---

## 12. Build sequence (reference for implementer)

Phase A — substrate
1. Repo init + go.mod.
2. `internal/spec/parse.go` + tests against all current citadel specs.
3. `internal/spec/render.go` + idempotency tests.
4. State-transition matrix + tests.

Phase B — tools
1. Read tools (`spec_list`, `spec_read`, `spec_status`, `spec_lint`, `spec_diff_summary`).
2. Atomic write tools (`spec_status_set`, `spec_ratify`, `spec_task_check`, `spec_task_add`).
3. Composite write tools (`spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`, `spec_handoff`).
4. `spec_index_rebuild`.

Phase C — MCP wiring
1. JSON-RPC server.
2. Tool registration with JSONSchema.
3. `cmd/citadel-sdd/main.go`.
4. Install script + Claude Code MCP server config snippet.

Phase D — close
1. CI parity test (lints citadel's live tree on every commit).
2. README + this PRD updated to reflect any v1 deviations.
3. Citadel `CLAUDE.md` cross-reference flipped from "forward-pointer" to "live tool — prefer over hand-editing".

---

## 13. Acceptance criteria

A1. `spec_claim`, `spec_close`, `spec_reopen` each exit successfully with idempotent diffs against fixture before-states.
A2. After `spec_close`, the spec's directory is in `specs/done/`, its status line says `DONE`, `tasks.md` has no open boxes (or only the explicitly-allowed phases), `specs/README.md` has the active-row removed and the done-row inserted at the top of the Done table, and a single conventional commit captures the diff.
A3. `spec_lint` returns the same findings as `python3 ~/.claude/skills/spec-status/scripts/spec-status.py --strict --include-done` exit-code-wise; finding lists may differ in shape (JSON vs text) but in count + severity must match.
A4. `spec_list --mine` returns only the specs whose Owner matches the configured caller principal.
A5. Every write tool supports `dryRun: true` and produces the same diff as the live call but without writing.
A6. Drift between `spec.md` status, `tasks.md` status, on-disk path, and `specs/README.md` index is impossible after any tool's success.

---

## 14. Out of scope

- Spec authoring agents (LLM still drafts the markdown).
- Plan-phase tracking (no `plan_phase_advance` tool — phase progression is implicit in tasks.md checkbox state).
- Multi-repo umbrella support (deferred to v2 + the `profile` arg).
- Automated migration apply (`supabase db push`) — that's a deploy concern, not a spec concern. May surface in a sibling `citadel-deploy` MCP later.
- Web UI / dashboard. The `/spec-status` skill already produces a Markdown roll-up; that's the reporting surface.
- GitHub PR / Issue cross-references. Citadel doesn't use GitHub Issues for spec tracking; this could be a follow-on.

---

## 15. Cross-references

- Citadel SDD discipline canon: `Rethunk-Tech/citadel/docs/specs.md`.
- NOMAD canon (rulings governing naming, activation): `Rethunk-Tech/citadel/docs/canon.md`.
- Existing lint script: `~/.claude/skills/spec-status/scripts/spec-status.py`.
- Bastion doctrine (who calls these tools): `~/.claude/commands/bastion/*.md`.
- Citadel project primer: `Rethunk-Tech/citadel/AGENTS.md` (CLAUDE.md is a symlink). Already updated 011917Z to reference this MCP as a forward-pointer.

---

## 16. Author note (for the next agent)

This PRD was authored at 011920ZMAY26 immediately after a five-spec session retrospective. The retrospective evidence is in the citadel commit log between `b745e3e` (first claim of the session) and `2dffde3` (last close of the session) — read those commits to feel the ceremony cost first-hand. The corrections to global doctrine that came out of the same retrospective landed in the same retrospective turn — see `~/.claude/CLAUDE.md` "Bash cwd persistence" + "Drop `; echo exit=\$?`" + "Biome reflows multi-line JSX" + "`batch_commit` may pick up extra dirty files" sections, plus the citadel `AGENTS.md` "Migration application" + "Spec lifecycle shortcut" sections.

If any of the patterns in this PRD seem over-engineered relative to the citadel surface today: don't trust that instinct. The mechanical cost compounds with every spec, and the citadel repo currently has 17 active DRAFT specs — that's 17 future claim-close cycles. The MCP pays back its build cost inside one of them.

NOTHING FURTHER.
