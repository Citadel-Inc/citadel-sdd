#!/usr/bin/env node
import process from 'node:process'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import pkg from '../package.json' with { type: 'json' }
import { loadConfig } from './config/load.ts'
import { env } from './env.ts'
import { buildServer } from './mcp/server.ts'
import {
  normalizeProjectRoot,
  resolveWorkspaceRoot,
  rootUriToPath,
  type WorkspaceRootPick,
} from './mcp/workspace.ts'
import { resolveBuiltIn } from './profile/resolver.ts'
import { gitConfigUserName, gitRevParseShowToplevel } from './spec/git.ts'
import type { ToolContext } from './tools/types.ts'

const VERSION: string = pkg.version

function discoverRootFallback(): string {
  const fromEnv = env.sddRoot
  if (fromEnv && fromEnv.length > 0) {
    return normalizeProjectRoot(fromEnv)
  }
  try {
    return normalizeProjectRoot(gitRevParseShowToplevel(process.cwd()))
  } catch {
    return normalizeProjectRoot(process.cwd())
  }
}

async function main(): Promise<void> {
  const fallbackRootDir = discoverRootFallback()
  let server: McpServer
  let cachedFileRoots: string[] = []

  const listClientRootPaths = async (): Promise<string[]> => {
    try {
      const caps = server.server.getClientCapabilities()
      if (!caps?.roots) {
        return cachedFileRoots
      }
      const result = await server.server.listRoots()
      cachedFileRoots = result.roots
        .map((root) => rootUriToPath(root.uri))
        .filter((path): path is string => path !== null)
      return cachedFileRoots
    } catch {
      return cachedFileRoots
    }
  }

  async function buildContext(input?: WorkspaceRootPick): Promise<ToolContext> {
    const rootDir = resolveWorkspaceRoot(input, await listClientRootPaths(), fallbackRootDir)
    let profile: ReturnType<typeof resolveBuiltIn>
    try {
      profile = loadConfig({ rootDir })
    } catch (e) {
      if (!(e instanceof Error && e.message.startsWith('config_missing:'))) {
        throw e
      }
      profile = resolveBuiltIn('default')
    }
    const principal = gitConfigUserName({ rootDir })
    return {
      rootDir,
      profile,
      principal: principal.length > 0 ? principal : undefined,
    }
  }

  server = buildServer({
    contextFactory: buildContext,
    name: '@rethunk/citadel-sdd',
    version: VERSION,
  })

  const refreshRoots = async (): Promise<void> => {
    await listClientRootPaths()
  }

  server.server.oninitialized = () => {
    // Best-effort: the server still serves requests against the fallback root.
    refreshRoots().catch(() => undefined)
  }

  server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
    await refreshRoots()
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  process.stderr.write(`citadel-sdd fatal: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
