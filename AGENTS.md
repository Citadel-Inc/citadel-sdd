# AGENTS.md — implementation map

IDEs injecting context: don't re-link from rules. Canonical content lives elsewhere; this file is the implementation-map rollup only.

## Canon pointers

- **Project rationale, scope, profile system, tool inventory, state machine, FS contract, decision log, testing strategy, promotion gate** → [PRD.md](PRD.md)
- **Dev setup, commit conventions, CI behavior, PR checklist, how-to-add-a-tool** → [CONTRIBUTING.md](CONTRIBUTING.md)
- **End-user install + quickstart + goal-oriented tool mapping** → [HUMANS.md](HUMANS.md)
- **Per-client wiring detail (Claude Code, Cursor, Zed, VS Code)** → [docs/install.md](docs/install.md)
- **Per-tool schema rollup** → [docs/mcp-tools.md](docs/mcp-tools.md)
- **Threat model + vulnerability reporting** → [SECURITY.md](SECURITY.md)

Don't duplicate any of the above into this file.

## Implementation status

**Phase A pending.** No `src/` yet. PRD ratified `011945ZMAY26`.

## Target file layout

Per [PRD § 8.2](PRD.md#82-layout):

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

## Contract-change rules

When you change a contract, update its canon location:

| Contract | Canon to update |
|----------|-----------------|
| Public tool surface (rename / add / remove) | [PRD § 4](PRD.md#4-tool-inventory-16-tools) + [docs/mcp-tools.md](docs/mcp-tools.md) + [HUMANS.md](HUMANS.md) goal-table |
| Profile config schema | [PRD § 3](PRD.md#3-profile-system) |
| State machine | [PRD § 5](PRD.md#5-state-machine) + transitions tests |
| File-system contract | [PRD § 6](PRD.md#6-file-system-contracts) + invariants checker |
| Promotion gate / versioning | [PRD § 9](PRD.md#9-testing-strategy) |
