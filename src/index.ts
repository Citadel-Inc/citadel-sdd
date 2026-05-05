#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config/load.js";
import { buildServer } from "./mcp/server.js";
import { resolveBuiltIn } from "./profile/resolver.js";
import { gitConfigUserName, gitRevParseShowToplevel } from "./spec/git.js";
import type { ToolContext } from "./tools/types.js";

const VERSION = "0.4.2";

function discoverRootFallback(): string {
  const fromEnv = process.env.CITADEL_SDD_ROOT;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  try {
    return gitRevParseShowToplevel(process.cwd());
  } catch {
    return process.cwd();
  }
}

function rootUriToPath(uri: string): string {
  try {
    return fileURLToPath(uri);
  } catch {
    return uri;
  }
}

async function main(): Promise<void> {
  let rootDir = discoverRootFallback();

  function buildContext(): ToolContext {
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
  }

  const server = buildServer({
    contextFactory: buildContext,
    name: "@rethunk/citadel-sdd",
    version: VERSION,
  });

  const refreshRoots = async (): Promise<void> => {
    try {
      const caps = server.server.getClientCapabilities();
      if (!caps?.roots) return;
      const result = await server.server.listRoots();
      const first = result.roots[0];
      if (first?.uri) {
        rootDir = rootUriToPath(first.uri);
      }
    } catch {
      // client doesn't support roots or request failed — keep current rootDir
    }
  };

  server.server.oninitialized = () => {
    void refreshRoots();
  };

  server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
    await refreshRoots();
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`citadel-sdd fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
