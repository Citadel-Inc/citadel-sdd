import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  findSingleRoot,
  resolveRoots,
  rootKey,
  scanNested,
  selectRoots,
} from "../../src/discovery/roots.js";

function makeTree(): { root: string; cleanup(): void } {
  const root = mkdtempSync(join(tmpdir(), "citadel-sdd-disc-"));
  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe("findSingleRoot", () => {
  test("walks up to find specs/active", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "repo", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "repo", "src", "deep"), { recursive: true });
      const r = findSingleRoot(join(t.root, "repo", "src", "deep"));
      expect(r).not.toBeNull();
      expect(r?.specsRoot).toBe(resolve(join(t.root, "repo", "specs")));
    } finally {
      t.cleanup();
    }
  });

  test("returns null when no specs/active above start", () => {
    const t = makeTree();
    try {
      const r = findSingleRoot(t.root);
      expect(r).toBeNull();
    } finally {
      t.cleanup();
    }
  });
});

describe("resolveRoots", () => {
  test("validates each path and dedupes", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "a", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "b", "specs", "active"), { recursive: true });
      const out = resolveRoots([
        join(t.root, "a"),
        join(t.root, "a"),
        join(t.root, "b"),
        join(t.root, "missing"),
      ]);
      expect(out.map((d) => d.key).sort()).toEqual(["a", "b"]);
    } finally {
      t.cleanup();
    }
  });

  test("accepts a path ending in /specs", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "p", "specs", "active"), { recursive: true });
      const out = resolveRoots([join(t.root, "p", "specs")]);
      expect(out).toHaveLength(1);
      expect(out[0]?.key).toBe("p");
    } finally {
      t.cleanup();
    }
  });
});

describe("scanNested", () => {
  test("finds nested specs/active dirs up to depth", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "lvl1", "x", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "lvl1", "y", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "lvl1", "deep", "deeper", "z", "specs", "active"), {
        recursive: true,
      });
      const found = scanNested({ parent: t.root, depth: 3 });
      const keys = found.map((d) => d.key).sort();
      expect(keys).toContain("x");
      expect(keys).toContain("y");
    } finally {
      t.cleanup();
    }
  });

  test("skips noise dirs (node_modules)", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "node_modules", "pkg", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "real", "specs", "active"), { recursive: true });
      const found = scanNested({ parent: t.root, depth: 5 });
      expect(found.map((d) => d.key)).toEqual(["real"]);
    } finally {
      t.cleanup();
    }
  });

  test("does not follow symlinks", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "real", "specs", "active"), { recursive: true });
      symlinkSync(join(t.root, "real"), join(t.root, "link"));
      const found = scanNested({ parent: t.root, depth: 3 });
      expect(found).toHaveLength(1);
    } finally {
      t.cleanup();
    }
  });
});

describe("selectRoots", () => {
  test("scan_nested takes precedence over roots and rootDir", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "a", "specs", "active"), { recursive: true });
      mkdirSync(join(t.root, "b", "specs", "active"), { recursive: true });
      const out = selectRoots({
        rootDir: t.root,
        specDir: "specs",
        roots: [join(t.root, "a")],
        scan_nested: { parent: t.root, depth: 2 },
      });
      const keys = out.map((d) => d.key).sort();
      expect(keys).toContain("a");
      expect(keys).toContain("b");
    } finally {
      t.cleanup();
    }
  });

  test("falls back to single rootDir when no roots/scan_nested", () => {
    const t = makeTree();
    try {
      mkdirSync(join(t.root, "specs", "active"), { recursive: true });
      const out = selectRoots({ rootDir: t.root, specDir: "specs" });
      expect(out).toHaveLength(1);
    } finally {
      t.cleanup();
    }
  });
});

describe("rootKey", () => {
  test("strips trailing /specs", () => {
    expect(rootKey("/a/b/myrepo/specs")).toBe("myrepo");
    expect(rootKey("/a/b/myrepo/specs/")).toBe("myrepo");
  });
});
