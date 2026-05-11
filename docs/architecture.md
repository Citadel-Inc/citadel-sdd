# Architecture

Permanent canon for: file layout, state machine, file-system contract, write invariants.

## File layout

```
src/
├── index.ts                # entrypoint (MCP stdio server)
├── mcp/
│   ├── server.ts           # JSON-RPC dispatch
│   ├── workspace.ts         # per-call MCP workspace root resolution
│   └── schemas.ts          # Zod-derived JSONSchema per tool
├── spec/
│   ├── types.ts            # shared types
│   ├── parse.ts            # frontmatter + Q-table + tasks.md parser
│   ├── render.ts           # canonical render (parse-render idempotent)
│   ├── transitions.ts      # state machine
│   ├── git.ts              # commit / push / mv (shells local git)
│   └── invariants.ts       # post-write invariant checker
├── lint/
│   ├── index.ts            # ported spec-status (TS port of archived Python)
│   └── rules.ts            # individual lint rules
├── profile/
│   ├── resolver.ts         # extends-chain walker
│   ├── default.yaml
│   ├── bastion.yaml
│   └── citadel.yaml
├── config/
│   └── load.ts             # specs/config.yaml loader + Zod validation
└── tools/                  # one file per MCP tool (18 + sdd_doctor)
    ├── spec_list.ts
    ├── spec_read.ts
    ├── ... (remaining tools)
    └── sdd_doctor.ts
```

Tests mirror `src/` under `tests/`. Synthetic fixtures live in `tests/spec-fixtures/`.

## State machine

```
DRAFT ──spec_approve──► APPROVED ──spec_claim──► IN_PROGRESS ──spec_close──► DONE
   │                                    │              │                       ▲
   │                                    │              ├──spec_park──► PARKED ─┤  (spec_close abandons)
   │                                    │              │                ╰──spec_unpark──► IN_PROGRESS
   │                                    │              ├─spec_block─► BLOCKED ─spec_unblock─► IN_PROGRESS
   │                                    │              │
   └──────spec_claim (allowed if claimer = author)─────┘
                                                     ▲
                                                     │
                                              DONE ──spec_reopen──┘
```

`PARKED` is for specs that are **deliberately not pursued yet** (superseded, withdrawn, or held pending an external trigger such as a calendar gate, customer inbound, or Phase-N ratification). Reachable from DRAFT, APPROVED, IN_PROGRESS, or BLOCKED via `spec_park` (moves `specs/active/<slug>/` → `specs/parked/<slug>/`). Exits:

- `spec_unpark` → IN_PROGRESS (wake trigger fired; moves parked→active).
- `spec_close` → DONE (abandon; trigger permanently obsolete).

Transition rules:

- DRAFT → IN_PROGRESS direct: allowed only when claimer matches spec's authored Owner.
- BLOCKED reachable only from IN_PROGRESS.
- DRAFT → DONE direct: invalid.
- DONE → DRAFT: invalid; use `spec_reopen` then iterate.
- BLOCKED → DONE direct: invalid; `spec_unblock` first (the close error message says so).
- Each transition appends a row to `## History` in `spec.md` (DTG + actor + transition).

## File-system contract

| Path | Read | Write | Notes |
|------|:---:|:---:|-------|
| `specs/config.yaml` | ✓ | spec_init only | Profile config. |
| `specs/active/<slug>/spec.md` | ✓ | ✓ | Top-of-file `\| Status \|…\|` table = canonical state. |
| `specs/active/<slug>/plan.md` | ✓ | — | Edited by humans/agents; MCP does not write. |
| `specs/active/<slug>/tasks.md` | ✓ | ✓ | Status line + checkbox state. |
| `specs/done/<slug>/{spec,plan,tasks}.md` | ✓ | ✓ | Same shape; `done/` location. |
| `specs/parked/<slug>/{spec,plan,tasks}.md` | ✓ | ✓ | PARKED state; intentionally not pursued. |
| `specs/README.md` | ✓ | ✓ | Three-table index: active + done + parked. Rows are derived from each spec’s `spec.md` frontmatter. **`spec_init` and `spec_index_rebuild` alone** replace the entire file from `renderIndex`. **All other writers** apply targeted markdown table edits (see [docs/mcp-tools.md](mcp-tools.md)) so prose after the Parked table is preserved. Per bucket, the **mutated** slug is written as the first data row after the table separator; strict global DTG ordering of every row is restored only by `spec_index_rebuild`. |
| `HUMAN_BLOCKERS.md` | ✓ | ✓ | Optional; created on first `spec_block` if absent. |

## Write invariants

Every write tool enforces these on completion. Failure → restore pre-call state (atomicity per [docs/decisions.md D-14](decisions.md)).

1. `spec.md` status table matches `tasks.md` status line.
2. Spec directory location matches state (`active/` for in-flight, `done/` for DONE, `parked/` for PARKED).
3. `specs/README.md` index mirrors disk (no orphan rows; no missing rows). Targeted README edits guarantee the mutated slug appears in the correct bucket table; run `spec_index_rebuild` to normalize full-file sort and recover from a malformed index.
4. Conventional-commit subject for every commit-emitting tool (when `commit_style: conventional`).
5. Deterministic file ordering for stable diffs.
6. Slug never reused (see [docs/profile-system.md](profile-system.md#slug-uniqueness)).
7. No path traversal: all writes scoped to `git rev-parse --show-toplevel`.

## Tool taxonomy

| Class | Count | Tools |
|-------|:---:|-------|
| Read | 5 | `spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor` |
| Write atomic | 5 | `spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff` |
| Write composite | 7 | `spec_claim`, `spec_close`, `spec_park`, `spec_unpark`, `spec_reopen`, `spec_block`, `spec_unblock` |
| Write infrastructure | 2 | `spec_index_rebuild`, `spec_init` |

All write tools support `dryRun: true`. Composite tools emit a single conventional commit by default. Per-tool inputs / outputs / failure modes: [docs/mcp-tools.md](mcp-tools.md).

Every tool resolves the target project root per call. Resolution order is: explicit `workspaceRoot`, `rootIndex` into MCP client file roots, primary MCP client file root, then process fallback (`CITADEL_SDD_ROOT`, git top-level of `cwd`, `cwd`). Roots are normalized to the containing `specs/active` tree when present, otherwise to the git top-level when available.
