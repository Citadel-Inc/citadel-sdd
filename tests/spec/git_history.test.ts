import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daysBetween, lastTouchedBulk, recentCommits } from "../../src/spec/git_history.js";

function makeRepo(): { root: string; cleanup(): void } {
  const root = mkdtempSync(join(tmpdir(), "citadel-sdd-git-"));
  execFileSync("git", ["-C", root, "init", "--initial-branch=main"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.name", "T"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "user.email", "t@e"], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
  return {
    root,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function commit(root: string, paths: ReadonlyArray<{ path: string; body: string }>, msg: string) {
  for (const p of paths) {
    const abs = join(root, p.path);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, p.body);
  }
  execFileSync("git", ["-C", root, "add", "--", ...paths.map((p) => p.path)], { stdio: "ignore" });
  execFileSync("git", ["-C", root, "commit", "-m", msg], { stdio: "ignore" });
}

describe("lastTouchedBulk", () => {
  test("returns latest commit date per spec dir", () => {
    const t = makeRepo();
    try {
      mkdirSync(join(t.root, "specs", "active", "alpha"), { recursive: true });
      mkdirSync(join(t.root, "specs", "active", "beta"), { recursive: true });
      commit(
        t.root,
        [
          { path: "specs/active/alpha/spec.md", body: "a" },
          { path: "specs/active/beta/spec.md", body: "b" },
        ],
        "init",
      );
      const map = lastTouchedBulk({
        metaRoot: t.root,
        specsRoot: join(t.root, "specs"),
        section: "active",
      });
      expect(map.has("alpha")).toBe(true);
      expect(map.has("beta")).toBe(true);
      const expected = execFileSync("git", ["-C", t.root, "log", "-1", "--format=%cs"], {
        encoding: "utf8",
      }).trim();
      expect(map.get("alpha")).toBe(expected);
      expect(map.get("beta")).toBe(expected);
    } finally {
      t.cleanup();
    }
  });

  test("returns empty on git-less tree", () => {
    const root = mkdtempSync(join(tmpdir(), "citadel-sdd-nogit-"));
    try {
      mkdirSync(join(root, "specs", "active"), { recursive: true });
      const map = lastTouchedBulk({
        metaRoot: root,
        specsRoot: join(root, "specs"),
        section: "active",
      });
      expect(map.size).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("recentCommits", () => {
  test("returns last-N subjects for a slug", () => {
    const t = makeRepo();
    try {
      mkdirSync(join(t.root, "specs", "active", "alpha"), { recursive: true });
      commit(t.root, [{ path: "specs/active/alpha/spec.md", body: "v1" }], "feat(alpha): start");
      commit(t.root, [{ path: "specs/active/alpha/spec.md", body: "v2" }], "feat(alpha): tweak");
      const lines = recentCommits({
        metaRoot: t.root,
        specsRoot: join(t.root, "specs"),
        section: "active",
        slug: "alpha",
        limit: 5,
      });
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain("feat(alpha): tweak");
    } finally {
      t.cleanup();
    }
  });

  test("limit=0 returns []", () => {
    const t = makeRepo();
    try {
      const lines = recentCommits({
        metaRoot: t.root,
        specsRoot: join(t.root, "specs"),
        section: "active",
        slug: "x",
        limit: 0,
      });
      expect(lines).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});

describe("daysBetween", () => {
  test("computes UTC day delta", () => {
    expect(daysBetween("2026-05-01", new Date("2026-05-08T00:00:00Z"))).toBe(7);
    expect(daysBetween("2026-05-08", new Date("2026-05-08T00:00:00Z"))).toBe(0);
  });

  test("returns null on bad input", () => {
    expect(daysBetween("garbage", new Date())).toBeNull();
  });
});
