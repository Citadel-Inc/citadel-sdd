import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  normalizeProjectRoot,
  resolveWorkspaceRoot,
  rootUriToPath,
} from "../../src/mcp/workspace.js";

function makeTree(): { root: string; cleanup(): void } {
  const root = mkdtempSync(join(tmpdir(), "citadel-sdd-workspace-"));
  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe("workspace root resolution", () => {
  test("converts file root URIs and ignores non-file roots", () => {
    expect(rootUriToPath("file:///tmp/citadel-sdd")).toBe("/tmp/citadel-sdd");
    expect(rootUriToPath("vscode-remote://ssh-remote/project")).toBeNull();
  });

  test("normalizes a nested workspace folder to the containing specs root", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "repo", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "repo", "src", "deep"), { recursive: true });
      expect(normalizeProjectRoot(join(t.root, "repo", "src", "deep"))).toBe(
        resolve(join(t.root, "repo")),
      );
    } finally {
      t.cleanup();
    }
  });

  test("prefers workspaceRoot, then rootIndex, then primary MCP root, then fallback", () => {
    const t = makeTree();
    try {
      const a = join(t.root, "a");
      const b = join(t.root, "b");
      const c = join(t.root, "c");
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      mkdirSync(c, { recursive: true });

      expect(resolveWorkspaceRoot({ workspaceRoot: c, rootIndex: 1 }, [a, b], t.root)).toBe(
        resolve(c),
      );
      expect(resolveWorkspaceRoot({ rootIndex: 1 }, [a, b], t.root)).toBe(resolve(b));
      expect(resolveWorkspaceRoot(undefined, [a, b], t.root)).toBe(resolve(a));
      expect(resolveWorkspaceRoot(undefined, [], c)).toBe(resolve(c));
    } finally {
      t.cleanup();
    }
  });

  test("throws a structured error for an invalid rootIndex", () => {
    expect(() => resolveWorkspaceRoot({ rootIndex: 2 }, ["/tmp/a"], "/tmp/fallback")).toThrow(
      "root_index_out_of_range",
    );
  });
});
