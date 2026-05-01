# AGENTS.md — LLM + dev onboarding

IDEs injecting context: don't re-link from rules.

**Package:** [`@rethunk/citadel-sdd`](https://github.com/Rethunk-AI/citadel-sdd) (TBD on publish). MCP **stdio** server. TypeScript on Bun.

**Canonical docs — don't duplicate:**
- Project rationale, scope, tool inventory, decision log → [PRD.md](PRD.md)
- Dev setup, commit conventions, CI → [CONTRIBUTING.md](CONTRIBUTING.md)
- User-facing install + usage → [HUMANS.md](HUMANS.md)
- Security policy → [SECURITY.md](SECURITY.md)

## What this is

MCP server wrapping **Spec-Driven Development** lifecycle. Replaces ~15 hand-edited Edit/Write/git-mv tool calls per spec claim/close cycle with atomic MCP tools.

Three shipped profiles: `default` (vanilla SDD), `bastion` (extends default), `citadel` (extends bastion).

## Implementation status

**Phase A pending.** No `src/` yet. PRD ratified `011945ZMAY26`.

Target file layout per [PRD § 8.2](PRD.md#82-layout):

```
src/
├── index.ts                # entrypoint
├── mcp/                    # JSON-RPC dispatch + schemas
├── spec/                   # parse / render / transitions / git / invariants
├── lint/                   # ported spec-status
├── profile/                # resolver + default/bastion/citadel YAMLs
├── config/                 # specs/config.yaml loader
└── tools/                  # one file per MCP tool
```

## Tool surface

16 tools + 1 diagnostic. Roster + schemas in [PRD § 4](PRD.md#4-tool-inventory-16-tools).

| Class | Tools |
|-------|-------|
| Read | `spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor` |
| Write atomic | `spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff` |
| Write composite | `spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock` |
| Write infrastructure | `spec_index_rebuild`, `spec_init` |

## Profile system

`specs/config.yaml` per consuming repo. `extends:` walks chain `default → bastion → citadel`. Resolver merges parent → child.

## Validate + CI

Local (Phase A onward): `bun run build` | `bun run check` | `bun run test`. v0.1.0 promotion gate: synthetic-fixture suite green ×7 consecutive commits.

> **Citadel-parity validation runs OFF GitHub CI** — citadel is private and we do not trust GitHub-hosted runners with token access to it. Maintainers run parity locally against `Rethunk-Tech/citadel` before tagging v0.1.0. Public CI uses synthetic fixtures only.

## Changing contracts

- **Public tool surface:** rename/add → update [PRD.md](PRD.md) § 4 + [HUMANS.md](HUMANS.md) tool table + this file's tool surface.
- **Profile config schema:** any change to `specs/config.yaml` keys → bump profile schema version + document migration in [CHANGELOG.md](CHANGELOG.md).
- **State machine:** any new transition → update [PRD § 5](PRD.md#5-state-machine) + transitions test fixtures.
