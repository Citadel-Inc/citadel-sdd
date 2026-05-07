import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findSingleRoot } from "../discovery/roots.js";
import { gitRevParseShowToplevel } from "../spec/git.js";

export interface WorkspaceRootPick {
  workspaceRoot?: string;
  rootIndex?: number;
}

export function rootUriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

export function normalizeProjectRoot(start: string): string {
  const absolute = resolve(start);
  const discovered = findSingleRoot(absolute);
  if (discovered) return discovered.metaRoot;
  try {
    return gitRevParseShowToplevel(absolute);
  } catch {
    return absolute;
  }
}

export function resolveWorkspaceRoot(
  input: WorkspaceRootPick | undefined,
  fileRoots: readonly string[],
  fallbackRoot: string,
): string {
  const explicit = input?.workspaceRoot?.trim();
  if (explicit) return normalizeProjectRoot(explicit);

  const rootIndex = input?.rootIndex;
  if (rootIndex != null) {
    const selected = fileRoots[rootIndex];
    if (!selected) {
      throw new Error(
        `root_index_out_of_range: rootIndex=${rootIndex} rootCount=${fileRoots.length}`,
      );
    }
    return normalizeProjectRoot(selected);
  }

  const primary = fileRoots[0];
  if (primary) return normalizeProjectRoot(primary);
  return normalizeProjectRoot(fallbackRoot);
}
