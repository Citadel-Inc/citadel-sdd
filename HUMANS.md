# @rethunk/citadel-sdd — User guide

MCP server wrapping **Spec-Driven Development** lifecycle. Drops mechanical ceremony from agent-driven spec workflows.

## Canon pointers

- **What it is, why, scope, profile system, tool inventory, state machine, decision log** → [PRD.md](PRD.md)
- **Per-client wiring (Claude Code, Cursor, Zed, VS Code) + from-source build** → [docs/install.md](docs/install.md)
- **Per-tool schema reference** → [docs/mcp-tools.md](docs/mcp-tools.md)
- **Security / vulnerability reporting** → [SECURITY.md](SECURITY.md)
- **Build status + project state** → [README.md](README.md)

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
└── done/.gitkeep
```

Choose a different profile by editing `specs/config.yaml` — see [PRD § 3 Profile system](PRD.md#3-profile-system).

## Common operations

Goal-oriented tool mapping. For full schemas see [docs/mcp-tools.md](docs/mcp-tools.md).

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
| Reopen (DONE → IN_PROGRESS) | `spec_reopen` |
| Block / unblock | `spec_block` / `spec_unblock` |
| Regenerate `specs/README.md` | `spec_index_rebuild` |
| Bootstrap fresh repo | `spec_init` |

All write tools support `dryRun: true` for preview.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Publishing

Phase D onward. See [PRD § 11](PRD.md#11-build-sequence).
