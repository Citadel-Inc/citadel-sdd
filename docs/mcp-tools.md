# MCP Tools — citadel-sdd

> **Canonical schema location:** [PRD § 4](../PRD.md#4-tool-inventory-16-tools).
> This file is the human-readable rollup; tool input/output JSONSchema lives in `src/mcp/schemas.ts` (Phase C).

## Tool roster

| Tool | Class | Purpose | Phase |
|------|-------|---------|-------|
| `spec_list` | Read | List specs by state, optionally filtered to caller. | B |
| `spec_read` | Read | Return combined spec + plan + tasks for a slug. | B |
| `spec_status` | Read | Single-spec status summary (state, DTG, owner, Q-table, task counts). | B |
| `spec_lint` | Read | Strict-mode validator; ported from archived `spec-status.py`. | B |
| `sdd_doctor` | Read | Diagnose existing repo, infer profile, flag drift. | B |
| `spec_approve` | Write atomic | DRAFT → APPROVED. | B |
| `spec_ratify` | Write atomic | Replace `TBD` Q-table rows with `Ratified <DTG>`. | B |
| `spec_task_check` | Write atomic | Flip a `tasks.md` checkbox. | B |
| `spec_task_add` | Write atomic | Append checklist item to a phase. | B |
| `spec_handoff` | Write atomic | Reassign owner without state flip. | B |
| `spec_claim` | Write composite | DRAFT/APPROVED → IN_PROGRESS + ratify + commit. | B |
| `spec_close` | Write composite | IN_PROGRESS → DONE + `git mv` + index splice + commit (+ optional push). | B |
| `spec_reopen` | Write composite | DONE → IN_PROGRESS + reverse `git mv` + index splice + commit. | B |
| `spec_block` | Write composite | IN_PROGRESS → BLOCKED + reason + optional `HUMAN_BLOCKERS.md` row. | B |
| `spec_unblock` | Write composite | BLOCKED → IN_PROGRESS + reason close. | B |
| `spec_index_rebuild` | Write infra | Regenerate `specs/README.md` from per-spec frontmatter. | B |
| `spec_init` | Write infra | Bootstrap `specs/config.yaml` + skeleton on a fresh repo. | B |

All write tools support `dryRun: true` for preview without writing.

## Common parameters (target)

| Field | Default | Notes |
|-------|---------|-------|
| `dryRun` | `false` | Preview-only; no FS writes, no commits. |
| `commit` | profile-default | When false, leaves edits staged but does not commit. |
| `push` | profile-default | Push policy: `never` / `on_close` / `always`. |
| `format` | `"json"` | `"markdown"` for human-readable output. |

## Failure modes (rollup)

| Code | Trigger |
|------|---------|
| `state_invalid` | Requested transition not legal per [PRD § 5](../PRD.md#5-state-machine). |
| `slug_collision` | Slug already used in `active/` or `done/`. Slugs are uniqueness-enforced forever. |
| `working_tree_dirty` | Unrelated dirty paths in tree; commit refused unless `--allow-dirty`. |
| `ratify_required` | Q-table has `TBD` rows and `ratify=false`. |
| `tasks_open` | `spec_close` called with unchecked checkboxes outside `allow_open` whitelist. |
| `path_outside_repo` | Input path escapes `git rev-parse --show-toplevel`. Refused. |
| `profile_chain_broken` | `extends:` references unknown profile. |
| `config_invalid` | `specs/config.yaml` fails schema validation. |

## Per-tool reference

Schema details, full input/output examples, and edge-case behavior land in this file as Phase C completes. Until then, [PRD.md](../PRD.md) is canon — every detail there is normative.
