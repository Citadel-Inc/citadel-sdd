# Install


## Prerequisites

- **Bun ≥ 1.3.11** — primary runtime + package manager.
- **Node.js ≥ 22** — fallback for `npx` users.
- **Git ≥ 2.28** — required by file-system + commit tools.

## From npm

```bash
npx -y @rethunk/citadel-sdd
# or
bunx @rethunk/citadel-sdd
```

## Per-client wiring

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

## After install

First-run bootstrap and profile selection are covered in [HUMANS.md "Quickstart"](../HUMANS.md#quickstart). Profile system reference is [docs/profile-system.md](profile-system.md).
