# @rethunk/citadel-sdd — User guide

MCP server wrapping **Spec-Driven Development** lifecycle. Drop ~75 ceremony tool calls per multi-spec session.

**Implementation map and contract bumps:** [AGENTS.md](AGENTS.md).
**Tool schemas, JSON shapes, decision log:** [PRD.md](PRD.md) — canonical.

## Status

Phase A pending. PRD ratified `011945ZMAY26`. v0.0.x track until citadel-parity test green ×7.

## Authentication

V1 = local-only. MCP runs on agent's machine over stdio. No tokens, no remote endpoint, no telemetry.

V2 (deferred): bearer-token for hosted scenarios.

## Installation and running

(Phase D onward — when v0.1.0 ships.)

```bash
npx -y @rethunk/citadel-sdd          # via npmjs (Node ≥ 22)
bunx @rethunk/citadel-sdd            # via Bun
citadel-sdd                          # if installed globally
```

Minimal MCP client JSON (server name `citadel-sdd`):

```json
{
  "mcpServers": {
    "citadel-sdd": {
      "command": "npx",
      "args": ["-y", "@rethunk/citadel-sdd"]
    }
  }
}
```

The server discovers the consuming repo via `git rev-parse --show-toplevel`. Each repo declares its profile in `specs/config.yaml`.

## Quickstart on a fresh repo

```bash
cd my-project
# (later, via MCP) spec_init --profile default
# yields: specs/config.yaml + specs/active/.gitkeep + specs/done/.gitkeep + specs/README.md
```

## Profiles

```
default          # vanilla SDD — ISO-8601 DTG, freeform commits, push: never
  └── bastion    # DDHHMMZMONYY DTG, conventional commits, IRONLAW callouts
        └── citadel  # bastion + citadel paths + push: on_close
```

Choose profile in `specs/config.yaml`:

```yaml
extends: bastion
```

Profile-specific overrides allowed via additional keys in the same file. Resolution: parent → child merge.

## Tool surface

| Goal | Tool |
|------|------|
| List specs | `spec_list` |
| Read spec + plan + tasks | `spec_read` |
| Spec status summary | `spec_status` |
| Lint spec tree | `spec_lint` |
| Approve a draft | `spec_approve` |
| Ratify Q-table TBD rows | `spec_ratify` |
| Flip a tasks.md checkbox | `spec_task_check` |
| Add a tasks.md item | `spec_task_add` |
| Claim (DRAFT/APPROVED → IN_PROGRESS) | `spec_claim` |
| Close (IN_PROGRESS → DONE + git mv + index) | `spec_close` |
| Reopen (DONE → IN_PROGRESS + reverse mv) | `spec_reopen` |
| Block / unblock | `spec_block` / `spec_unblock` |
| Reassign owner | `spec_handoff` |
| Regenerate `specs/README.md` | `spec_index_rebuild` |
| Bootstrap fresh repo | `spec_init` |
| Diagnose existing repo | `sdd_doctor` |

All write tools support `dryRun: true`. Full schemas: [PRD § 4](PRD.md#4-tool-inventory-16-tools).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, build commands, git hooks, commit conventions, CI, and how to add tools or profiles.

## Publishing

(Phase D onward.)

### GitHub (automated) — version tags only

Tag pushes run `.github/workflows/release.yml`: build, check, tests, then attach `npm pack` tarball to a GitHub Release for that tag and publish to GitHub Packages.

Prerequisite: push a semver git tag `vX.Y.Z` that exactly matches `version` in `package.json`.

### npmjs (manual) — maintainers only

1. Clean checkout at release commit.
2. `bun run prepublishOnly`.
3. `npm whoami` confirms `@rethunk` ownership.
4. `npm publish --access public`.
