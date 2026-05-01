#!/usr/bin/env bash
# Install citadel-sdd as a Claude Code MCP server.
#
# Adds an entry to ~/.claude/mcp_servers.json (or the file pointed to by
# CLAUDE_MCP_CONFIG) using `bunx @rethunk/citadel-sdd` (preferred) or
# `npx -y @rethunk/citadel-sdd` (fallback) as the command.
#
# Idempotent: re-running replaces the existing `citadel-sdd` block.
#
# Requires: bash, jq.

set -euo pipefail

CONFIG="${CLAUDE_MCP_CONFIG:-$HOME/.claude/mcp_servers.json}"
SERVER_NAME="${CITADEL_SDD_SERVER_NAME:-citadel-sdd}"

if ! command -v jq >/dev/null 2>&1; then
  echo "install.sh requires jq; install via your package manager and retry." >&2
  exit 1
fi

if command -v bunx >/dev/null 2>&1; then
  CMD="bunx"
  ARGS='["@rethunk/citadel-sdd"]'
else
  CMD="npx"
  ARGS='["-y", "@rethunk/citadel-sdd"]'
fi

mkdir -p "$(dirname "$CONFIG")"

if [[ ! -f "$CONFIG" ]]; then
  echo '{"mcpServers": {}}' >"$CONFIG"
fi

ENTRY=$(jq -n \
  --arg cmd "$CMD" \
  --argjson args "$ARGS" \
  '{command: $cmd, args: $args}')

TMP=$(mktemp)
jq --arg name "$SERVER_NAME" --argjson entry "$ENTRY" \
  '.mcpServers[$name] = $entry' "$CONFIG" >"$TMP"
mv "$TMP" "$CONFIG"

echo "Installed $SERVER_NAME -> $CONFIG"
echo "Command: $CMD ${ARGS}"
