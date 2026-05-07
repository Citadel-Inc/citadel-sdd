#!/usr/bin/env node
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RootsListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config/load.js";
import { buildServer } from "./mcp/server.js";
import {
  normalizeProjectRoot,
  resolveWorkspaceRoot,
  rootUriToPath,
  type WorkspaceRootPick,
} from "./mcp/workspace.js";
import { resolveBuiltIn } from "./profile/resolver.js";
import { gitConfigUserName, gitRevParseShowToplevel } from "./spec/git.js";
import type { ToolContext } from "./tools/types.js";

const VERSION = "0.4.2";

function discoverRootFallback(): string {
  const fromEnv = process.env.CITADEL_SDD_ROOT;
  if (fromEnv && fromEnv.length > 0) return normalizeProjectRoot(fromEnv);
  try {
    return normalizeProjectRoot(gitRevParseShowToplevel(process.cwd()));
  } catch {
    return normalizeProjectRoot(process.cwd());
  }
}

async function main(): Promise<void> {
  const fallbackRootDir = discoverRootFallback();
  let server: McpServer;
  let cachedFileRoots: string[] = [];

  const listClientRootPaths = async (): Promise<string[]> => {
    try {
      const caps = server.server.getClientCapabilities();
      if (!caps?.roots) return cachedFileRoots;
      const result = await server.server.listRoots();
      cachedFileRoots = result.roots
        .map((root) => rootUriToPath(root.uri))
        .filter((path): path is string => path !== null);
      return cachedFileRoots;
    } catch {
      return cachedFileRoots;
    }
  };

  async function buildContext(input?: WorkspaceRootPick): Promise<ToolContext> {
    const rootDir = resolveWorkspaceRoot(input, await listClientRootPaths(), fallbackRootDir);
    let profile: ReturnType<typeof resolveBuiltIn>;
    try {
      profile = loadConfig({ rootDir });
    } catch (e) {
      if (!(e instanceof Error) || !e.message.startsWith("config_missing:")) {
        throw e;
      }
      profile = resolveBuiltIn("default");
    }
    const principal = gitConfigUserName({ rootDir });
    return {
      rootDir,
      profile,
      principal: principal.length > 0 ? principal : undefined,
    };
  }

  server = buildServer({
    contextFactory: buildContext,
    name: "@rethunk/citadel-sdd",
    version: VERSION,
  });

  const refreshRoots = async (): Promise<void> => {
    await listClientRootPaths();
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
