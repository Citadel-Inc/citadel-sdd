# Install

> **Status:** Phase D placeholder. Real install instructions land when v0.1.0 ships.
> Until then, see [PRD § 11 Build sequence](../PRD.md#11-build-sequence) for what's gated on what.

## Prerequisites (target)

- **Bun ≥ 1.3.11** — primary runtime + package manager.
- **Node.js ≥ 22** — fallback for `npx` users.
- **Git ≥ 2.28** — required by file-system + commit tools.

## From npm (target)

```bash
npx -y @rethunk/citadel-sdd
# or
bunx @rethunk/citadel-sdd
```

## Per-client wiring (target)

### Claude Code

Add to `~/.claude/mcp_servers.json`:

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

### Cursor / Zed / VS Code

Same shape under each client's MCP config block. The server speaks MCP over stdio.

## From source

```bash
git clone https://github.com/Rethunk-AI/citadel-sdd.git
cd citadel-sdd
bun install
bun run build
node dist/index.js  # or: bun run dist/index.js
```

## Bootstrap a fresh repo

Inside the consuming repo:

```bash
# (via MCP client) call: spec_init({ profile: "default" })
```

Yields:

```
specs/
├── config.yaml           # profile declaration
├── README.md             # auto-generated index (empty)
├── active/.gitkeep
└── done/.gitkeep
```

## Profile selection

Edit `specs/config.yaml`:

```yaml
extends: bastion          # or: default | citadel
```

See [PRD § 3 Profile system](../PRD.md#3-profile-system) for full schema and inheritance rules.

## Verification

```bash
# (via MCP client) call: sdd_doctor({})
# Expected: { inferred_profile: "...", findings: [], drift: false }
```
