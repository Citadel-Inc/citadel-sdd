# PRD — `citadel-sdd` MCP server

| | |
|---|---|
| Status | **DRAFT 011945ZMAY26** — ratified scope; ready for Phase A. |
| Audience | Bastion, Citadel operators, Citadel customers, public agent-workflow consumers. |
| Position | `Rethunk-AI/citadel-sdd` — sibling of `Rethunk-Tech/citadel`. Standalone repo. |
| License | MIT. |
| Language | TypeScript on Bun (matches `rethunk-github-mcp`, `rethunk-mcp-go`, `rethunk-mcp-ts`). |
| Versioning | Semver from `v0.0.x`. Promote to `v0.1.0` on first citadel-parity green. |
| Authoring origin | 2026-05-01 retrospective: ~15 mechanical tool calls per spec lifecycle × 5 specs = ~75 ceremony calls per session. |

---

## 1. Mission

Wrap **Spec-Driven Development** lifecycle into atomic MCP tools so any agent (Bastion, Claude Code, customer agent, OSS agent) can drive specs without 15 hand-edits per claim/close cycle.

Goals (priority order):

1. **Reduce ceremony.** One MCP call per lifecycle event.
2. **Eliminate drift.** `spec.md` status, `tasks.md` status, directory location (active/done), `specs/README.md` index — four places holding one fact, written atomically.
3. **Be discoverable.** Agents find unclaimed approved specs without `ls`+`grep` per session.
4. **Fail loud.** Lint invalid transitions before they corrupt the tree.
5. **Generalise.** Profile-based config so Citadel, customers, and OSS users share one tool.

---

## 2. Scope

### 2.1 IN-scope (v1)

- Spec lifecycle (16 tools, see § 4).
- Profile-based config at `specs/config.yaml` per-repo.
- Three shipped profiles: `default` (vanilla SDD), `bastion` (extends default; DTG injection, militant commit voice), `citadel` (extends bastion; citadel paths, conventions, push policy). Profile resolver walks `extends` chain.
- TypeScript port of `spec-status.py` lint script (drops Python dep for public users).
- `/spec-status` slash command rewired to call `spec_lint` MCP tool.

### 2.2 OUT-scope (v1)

- GitHub/GitLab API integration (PR creation, issue linking, label sync). Local FS + git only.
- Spec authoring AI. Tool wraps mechanics; consumer's LLM writes content.
- Multi-repo coordination. One repo per MCP instance.
- Q-table reasoning. Tool flips `TBD` → `Ratified <DTG>`; agent decides what to ratify.
- CI/deploy hooks (citadel-specific; lives in citadel).
- Web UI / dashboard. JSON-RPC only.
- Telemetry. Zero opt-in stats v1.

---

## 3. Profile system

### 3.1 Config location

`specs/config.yaml` rooted in the consuming repo. Single canonical path; no `.sdd/` directory, no home-dir config.

### 3.2 Inheritance

```
default (neutral SDD baseline)
  └── bastion (DTG injection, IRONLAW callouts, conventional commit + Bastion voice)
        └── citadel (bastion + citadel paths/conventions + C10 auto-push)
```

`extends:` key in `specs/config.yaml` walks the chain. Resolver merges parent → child; child overrides parent leaves.

### 3.3 Config shape (illustrative)

```yaml
extends: bastion           # or: default | citadel | <none>
spec_dir: specs            # canonical; rarely overridden
states:
  - DRAFT
  - APPROVED
  - IN_PROGRESS
  - BLOCKED
  - DONE
priorities: [P0, P1, P2]
dtg_format: DDHHMMZMONYY    # bastion default; default profile uses ISO-8601
commit_style: conventional   # conventional | freeform
push_policy: never           # never | on_close | always
slug_uniqueness: forever     # not configurable; documented for transparency
```

### 3.4 Slug uniqueness

**Enforced forever, not configurable.** A slug used in `specs/active/` or `specs/done/` is held permanently; reuse rejected even after a `spec_close`. This rule is hard-coded — the `slug_uniqueness: forever` line above is documentation, not a switch.

---

## 4. Tool inventory (16 tools)

| # | Tool | Class | Composite? |
|---|------|-------|-----------|
| 4.1 | `spec_list` | Read | — |
| 4.2 | `spec_read` | Read | — |
| 4.3 | `spec_status` | Read | — |
| 4.4 | `spec_lint` | Read | — |
| 4.5 | `spec_approve` | Write atomic | — |
| 4.6 | `spec_ratify` | Write atomic | — |
| 4.7 | `spec_task_check` | Write atomic | — |
| 4.8 | `spec_task_add` | Write atomic | — |
| 4.9 | `spec_claim` | Write composite | DRAFT/APPROVED → IN_PROGRESS |
| 4.10 | `spec_close` | Write composite | IN_PROGRESS → DONE + `git mv` + index splice |
| 4.11 | `spec_reopen` | Write composite | DONE → IN_PROGRESS + reverse `git mv` + index splice |
| 4.12 | `spec_block` | Write composite | IN_PROGRESS → BLOCKED + reason + HUMAN_BLOCKERS row |
| 4.13 | `spec_unblock` | Write composite | BLOCKED → IN_PROGRESS + reason close |
| 4.14 | `spec_handoff` | Write atomic | — (owner change, no state flip) |
| 4.15 | `spec_index_rebuild` | Write | full `specs/README.md` regen |
| 4.16 | `spec_init` | Write | bootstrap fresh repo |
| 4.17 | `sdd_doctor` | Read | diagnose existing repo, suggest profile, flag drift |

(17 listed; counted as "16 tools + doctor" since `sdd_doctor` is diagnostic-only.)

### 4.5 `spec_approve`

Replaces dropped `spec_status_set`. Sole legal use: DRAFT → APPROVED. All other transitions covered by composites.

**Inputs:** `{ slug, note? }`.
**Output:** `{ slug, before, after, commit_sha }`.
**Behavior:** flip status, conventional commit `spec(<slug>): APPROVED — <note?>`.

### 4.16 `spec_init`

Bootstraps fresh repo. Writes:
- `specs/config.yaml` (chosen profile)
- `specs/README.md` (empty index)
- `specs/active/.gitkeep`
- `specs/done/.gitkeep`

**Inputs:** `{ profile: "default"|"bastion"|"citadel"|"custom", overrides?: object }`.
**Output:** `{ created_files, profile_resolved }`.

### 4.17 `sdd_doctor`

Diagnoses existing repo. Detects spec dir layout, infers best-match profile, flags drift between `spec.md`/`tasks.md`/`specs/README.md`/disk path. Read-only.

**Output:** `{ inferred_profile, findings: [{severity, message, path}], drift: bool }`.

### 4.1 – 4.4, 4.6 – 4.15

Inputs/outputs/failure modes per prior PRD draft, with these adjustments:
- **`spec_lint`** — calls TypeScript port of `spec-status.py` (in-process, no shell-out).
- **`spec_close`** — `push` arg default per profile (`citadel` profile = `true` per C10; `default` profile = `false`).
- **`spec_claim`** — commit author defaults to `git config user.name`/`user.email`; profile may override.
- All write tools accept `dryRun: true`.
- `spec_status_set` and `spec_diff_summary` removed.

---

## 5. State machine

```
DRAFT ──spec_approve──► APPROVED ──spec_claim──► IN_PROGRESS ──spec_close──► DONE
   │                                    │              │
   │                                    │              ├─spec_block─► BLOCKED ─spec_unblock─► IN_PROGRESS
   │                                    │
   └──────spec_claim (allowed if claimer = author)─────┘
                                                     ▲
                                                     │
                                              DONE ──spec_reopen──┘
```

- DRAFT → IN_PROGRESS direct: allowed only when claimer matches spec's authored Owner.
- BLOCKED reachable only from IN_PROGRESS.
- DRAFT → DONE direct: invalid.
- DONE → DRAFT: invalid; use `spec_reopen` then iterate.
- Each transition appends a row to `## History` in `spec.md` (DTG + actor + transition).

---

## 6. File-system contracts

| Path | RW | Notes |
|------|----|-------|
| `specs/config.yaml` | R | Profile config; written only by `spec_init`. |
| `specs/active/<slug>/spec.md` | RW | Top-of-file `\| Status \|…\|` table = canonical state. |
| `specs/active/<slug>/plan.md` | R | Edited by humans/agents; MCP doesn't touch. |
| `specs/active/<slug>/tasks.md` | RW | Status line + checkbox state. |
| `specs/done/<slug>/{spec,plan,tasks}.md` | RW | Same shape; `done/` location. |
| `specs/README.md` | RW | Two-table index: active + done. Auto-generated rows. |
| `HUMAN_BLOCKERS.md` | RW | Optional; created on first `spec_block` if absent. |

**Invariants enforced on every write:**

1. `spec.md` status table matches `tasks.md` status line.
2. Spec directory location matches state (active/ for non-DONE, done/ for DONE).
3. `specs/README.md` index mirrors disk (no orphan rows; no missing rows).
4. Conventional-commit subject for every commit-emitting tool (when `commit_style: conventional`).
5. Deterministic file ordering for stable diffs.
6. Slug never reused.

---

## 7. Authentication / authorization

V1: local-only. MCP runs on agent's machine, exposes endpoint over stdio (per MCP convention) or local socket; trusts the connecting agent.

V2 (deferred): bearer-token auth for hosted MCP scenarios.

---

## 8. Implementation

### 8.1 Language + runtime

TypeScript on Bun (matches Rethunk MCP convention).

### 8.2 Layout

```
citadel-sdd/
├── README.md
├── PRD.md                          # this file
├── LICENSE                         # MIT
├── package.json
├── bun.lock
├── biome.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # MCP server entrypoint
│   ├── mcp/
│   │   ├── server.ts               # JSON-RPC dispatch
│   │   ├── tools.ts                # tool registration
│   │   └── schemas.ts              # JSONSchema per tool
│   ├── spec/
│   │   ├── parse.ts                # frontmatter + Q-table + tasks.md parser
│   │   ├── render.ts               # canonical render
│   │   ├── transitions.ts          # state machine
│   │   ├── git.ts                  # commit / push / mv (shells `git`)
│   │   └── invariants.ts           # post-write invariant checker
│   ├── lint/
│   │   ├── index.ts                # ported spec-status.py
│   │   └── rules.ts                # individual lint rules
│   ├── profile/
│   │   ├── resolver.ts             # extends-chain walker
│   │   ├── default.yaml
│   │   ├── bastion.yaml
│   │   └── citadel.yaml
│   ├── config/
│   │   └── load.ts                 # specs/config.yaml loader
│   └── tools/                      # one file per MCP tool
│       ├── spec_list.ts
│       ├── spec_read.ts
│       ├── ... (16 files)
│       └── sdd_doctor.ts
├── tests/
│   ├── spec-fixtures/              # canonical/corrupt/edge specs
│   ├── golden/                     # expected post-edit states
│   └── *.test.ts                   # bun test runner
└── scripts/
    └── install.sh                  # adds server to ~/.claude/mcp_servers.json
```

### 8.3 Dependencies (npm)

- `@modelcontextprotocol/sdk` — MCP SDK.
- `yaml` — config parser.
- `zod` — input schemas + JSONSchema export.
- `simple-git` — git ops (or shell-out).
- `gray-matter` — markdown frontmatter (table-style frontmatter parsed manually).

### 8.4 No Python dependency

`spec-status.py` ported to `src/lint/`. Citadel `/spec-status` slash command rewired to invoke `spec_lint` MCP tool. Python script archived (not deleted) until parity confirmed.

---

## 9. Testing strategy

- **Unit:** `tests/*.test.ts` (bun test) — parser round-trips on all 30+ existing citadel specs (good + bad). Render-then-parse must be idempotent.
- **Golden:** snapshot diffs for `spec_claim`/`spec_close`/`spec_reopen` against fixture before-states.
- **Integration:** spin temp git repo from fixtures, run each tool end-to-end, assert tree + commit log shape.
- **Synthetic-fixture suite:** hand-authored fixtures under `tests/spec-fixtures/` cover every state, transition, Q-table shape, and lint-rule trigger. Public CI runs these only — no GitHub-hosted runner ever holds credentials to citadel.
- **Profile parity:** every profile (`default`, `bastion`, `citadel`) round-trips through full lifecycle on a fixture repo.
- **Citadel parity (off-CI, maintainer-only):** `spec_lint` against `Rethunk-Tech/citadel`'s live tree must match archived `spec-status.py --strict --include-done` exit-code-wise. Run locally on a maintainer's machine before tagging. **Never run in GitHub CI** — citadel is private and we do not trust hosted runners with token access.

**Promotion gate:** v0.0.x → v0.1.0 only when (a) synthetic-fixture suite green for 7 consecutive commits AND (b) maintainer-run citadel-parity green on the candidate commit.

---

## 10. Decision log (RATIFIED 011945ZMAY26)

| # | Decision | Value |
|---|----------|-------|
| Q-A | License | MIT |
| Q-B | Language / runtime | TypeScript on Bun |
| Q-C | Config format | YAML at `specs/config.yaml` |
| Q-D | Lint script | Ported Python → TS; `/spec-status` calls `spec_lint` MCP tool |
| Q-E | Commit author | `git config user.name`/`user.email`; profile may override |
| Q-F | Push policy | Profile-configurable (`never`/`on_close`/`always`); citadel = `on_close`, default = `never` |
| Q-G | Bastion features | Neutral default; `bastion` profile adds DTG/IRONLAW/voice; `citadel` extends `bastion` |
| Q-H | Telemetry | Zero |
| Q-I | Slug uniqueness | Enforced forever; not configurable |
| Q-J | Versioning | Semver from `v0.0.x`; `v0.1.0` on first citadel-parity green |

| # | Operational decision | Value |
|---|---------------------|-------|
| Q1 | Repo path discovery | `git rev-parse --show-toplevel`; abort if no `specs/config.yaml`. |
| Q2 | DTG source | `new Date()` UTC; never accept caller-supplied. Format per profile (`DDHHMMZMONYY` for bastion, ISO-8601 for default). |
| Q3 | Q-table parser strictness | Canonical shape only (`\| # \| Question \| Proposed default \| NOMAD \|`). Lint-fail on deviation. |
| Q4 | Atomicity | All-or-nothing per tool. Buffer edits in memory; write-all-or-restore. |
| Q5 | README done-row generation | Built from `spec.md` frontmatter + `summary` arg. Never hand-edited blob. |
| Q6 | Multi-claimer collision | Refuse `spec_claim` if IN_PROGRESS with different owner. Harness should `spec_status` first. |
| Q7 | History preservation on REOPEN | Append `## History` row in `spec.md` per transition. Survives close→reopen→close. |

---

## 11. Build sequence

### Phase A — substrate
1. `package.json`, `tsconfig.json`, `biome.json`, `bun.lock`, MIT `LICENSE`.
2. `src/spec/parse.ts` + tests against citadel's existing 30+ specs.
3. `src/spec/render.ts` + idempotency tests.
4. `src/spec/transitions.ts` + tests.
5. `src/profile/resolver.ts` + three shipped profiles.

### Phase B — tools
1. Read tools (`spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor`).
2. Atomic write tools (`spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff`).
3. Composite write tools (`spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`).
4. `spec_index_rebuild`, `spec_init`.

### Phase C — MCP wiring
1. JSON-RPC server via `@modelcontextprotocol/sdk`.
2. Tool registration with Zod-derived JSONSchema.
3. `src/index.ts` entrypoint.
4. `scripts/install.sh` for `~/.claude/mcp_servers.json`.

### Phase D — close
1. Public CI green on synthetic-fixture suite (no citadel access in CI).
2. Citadel `/spec-status` slash command rewired to MCP.
3. Citadel `CLAUDE.md` flips forward-pointer → live-tool.
4. Maintainer-run citadel-parity validation green on candidate commit.
5. Tag `v0.1.0` after 7 consecutive synthetic-suite green commits + parity green on candidate.

---

## 12. Acceptance criteria

A1. `spec_claim`/`spec_close`/`spec_reopen` exit successfully with idempotent diffs against fixture before-states.
A2. After `spec_close`: dir in `specs/done/`, status `DONE`, all checkboxes flipped (or explicitly allow-listed), `specs/README.md` active-row removed + done-row top-of-Done, single conventional commit captures the diff.
A3. `spec_lint` exit-code parity with archived Python `spec-status.py --strict --include-done` across (a) the synthetic-fixture suite (verified in CI) and (b) the live `Rethunk-Tech/citadel` tree (verified locally by maintainer before v0.1.0 tag).
A4. `spec_list --mine` returns only specs whose Owner matches caller principal.
A5. Every write tool supports `dryRun: true` with diff-equivalence to live call.
A6. Drift between `spec.md` status, `tasks.md` status, on-disk path, `specs/README.md` index = impossible after any tool's success.
A7. Profile resolver: `extends: citadel` produces effective config matching hand-merged citadel+bastion+default.
A8. `spec_init --profile default` on empty repo produces a working SDD scaffold lintable by `spec_lint`.

---

## 13. Cross-references

- Citadel SDD canon: `Rethunk-Tech/citadel/docs/specs.md`.
- NOMAD canon: `Rethunk-Tech/citadel/docs/canon.md`.
- Archived Python lint (until TS port parity-verified): `~/.claude/skills/spec-status/scripts/spec-status.py`.
- Bastion doctrine: `~/.claude/commands/bastion/*.md`.
- Sibling MCP servers (TS/Bun reference): `Rethunk-AI/rethunk-github-mcp`, `Rethunk-AI/rethunk-mcp-go`, `Rethunk-AI/rethunk-mcp-ts`.

---

## 14. Author note

PRD ratified 011945ZMAY26. Phase A starts immediately on next turn. Q-A through Q-J + Q1 through Q7 ratified — no further AskUserQuestion gates required before implementation. If implementer hits ambiguity not covered above, surface SCIR-6 (scope expansion) and hold for NCA direction.

NOTHING FURTHER.
