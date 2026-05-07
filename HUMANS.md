# HUMANS.md — User guide

MCP server wrapping **Spec-Driven Development** lifecycle for Bastion, Citadel operators, Citadel customers, and public agent workflows.

## Mission

Drop the ~15 mechanical tool calls per spec claim/close cycle (status flips, decision-log ratify, tasks.md sync, `git mv` active→done, targeted `specs/README.md` index rows, conventional-commit authoring) into **one atomic MCP call per lifecycle event**.

## Scope

**In:** spec lifecycle (claim, approve, close, park, reopen, block, unblock, ratify, handoff, task ops, lint, init, doctor), profile system (`default → bastion → citadel`), TS port of archived `spec-status.py`.

**Out:** GitHub/GitLab API, spec authoring AI, multi-repo coordination, Q-table reasoning, CI/deploy hooks, web UI, telemetry.

## Quickstart

Install per [docs/install.md](docs/install.md). Then in your project:

```bash
# (via your MCP client) call: spec_init({ profile: "default" })
```

Yields:

```
specs/
├── config.yaml
├── README.md
├── active/.gitkeep
├── done/.gitkeep
└── parked/.gitkeep
```

Choose a different profile by editing `specs/config.yaml`. See [docs/profile-system.md](docs/profile-system.md).

## Common operations

Goal-oriented tool mapping. Per-tool schemas in [docs/mcp-tools.md](docs/mcp-tools.md).

| Goal | Tool |
|------|------|
| List specs | `spec_list` |
| Read spec + plan + tasks | `spec_read` |
| Single-spec status summary | `spec_status` |
| Lint spec tree | `spec_lint` |
| Diagnose existing repo | `sdd_doctor` |
| Approve a draft | `spec_approve` |
| Ratify Q-table TBD rows | `spec_ratify` |
| Flip a tasks.md checkbox | `spec_task_check` |
| Add a tasks.md item | `spec_task_add` |
| Reassign owner | `spec_handoff` |
| Claim (DRAFT/APPROVED → IN_PROGRESS) | `spec_claim` |
| Close (IN_PROGRESS → DONE) | `spec_close` |
| Park (abandon / supersede — → PARKED) | `spec_park` |
| Reopen (DONE → IN_PROGRESS) | `spec_reopen` |
| Block / unblock | `spec_block` / `spec_unblock` |
| Regenerate `specs/README.md` | `spec_index_rebuild` |
| Bootstrap fresh repo | `spec_init` |

All write tools support `dryRun: true` for preview.

Tools automatically target the active MCP workspace root. In multi-root clients, pass `rootIndex` or `workspaceRoot` to select a different project; environment variables are only a fallback for clients without MCP roots support.

## Where to go next

- Install detail → [docs/install.md](docs/install.md)
- Per-tool schemas → [docs/mcp-tools.md](docs/mcp-tools.md)
- Profile system reference → [docs/profile-system.md](docs/profile-system.md)
- Security / vulnerability reporting → [SECURITY.md](SECURITY.md)
- Contributing → [CONTRIBUTING.md](CONTRIBUTING.md)
