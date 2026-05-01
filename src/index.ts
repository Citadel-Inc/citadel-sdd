#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/load.js";
import { buildServer } from "./mcp/server.js";
import { resolveBuiltIn } from "./profile/resolver.js";
import { gitConfigUserName, gitRevParseShowToplevel } from "./spec/git.js";
import type { ToolContext } from "./tools/types.js";

const VERSION = "0.0.1";

function discoverRoot(): string {
  const fromEnv = process.env.CITADEL_SDD_ROOT;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    return gitRevParseShowToplevel(process.cwd());
  } catch {
    return process.cwd();
  }
}

function buildContextFactory(): () => ToolContext {
  const rootDir = discoverRoot();
  return () => {
    let profile: ReturnType<typeof resolveBuiltIn>;
    try {
      profile = loadConfig({ rootDir });
    } catch {
      profile = resolveBuiltIn("default");
    }
    const principal = gitConfigUserName({ rootDir });
    return {
      rootDir,
      profile,
      principal: principal.length > 0 ? principal : undefined,
    };
  };
}

async function main(): Promise<void> {
  const server = buildServer({
    contextFactory: buildContextFactory(),
    name: "@rethunk/citadel-sdd",
    version: VERSION,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`citadel-sdd fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
