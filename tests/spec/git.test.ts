import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertWorkingTreeClean,
  gitAdd,
  gitCommit,
  gitConfigSet,
  gitConfigUserEmail,
  gitConfigUserName,
  gitInit,
  gitMv,
  gitRevParseShowToplevel,
  gitStatusPorcelain,
  gitWorkingTreeDirty,
} from "../../src/spec/git.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

describe("gitWorkingTreeDirty", () => {
  test("clean repo reports not dirty", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const r = gitWorkingTreeDirty({ rootDir: temp.rootDir });
    expect(r.dirty).toBe(false);
    expect(r.files).toEqual([]);
  });

  test("untracked file makes tree dirty", () => {
    temp = makeTempRepo();
    writeFileSync(join(temp.rootDir, "extra.txt"), "x");
    const r = gitWorkingTreeDirty({ rootDir: temp.rootDir });
    expect(r.dirty).toBe(true);
    expect(r.files).toContain("extra.txt");
  });

  test("ignorePaths filters out matching dirty files", () => {
    temp = makeTempRepo();
    writeFileSync(join(temp.rootDir, "ignored.txt"), "x");
    writeFileSync(join(temp.rootDir, "watched.txt"), "y");
    const r = gitWorkingTreeDirty({ rootDir: temp.rootDir }, ["ignored.txt"]);
    expect(r.dirty).toBe(true);
    expect(r.files).toEqual(["watched.txt"]);
  });

  test("ignorePaths filters out subtree dirty files", () => {
    temp = makeTempRepo();
    writeFileSync(join(temp.rootDir, "specs", "scratch.md"), "x");
    const r = gitWorkingTreeDirty({ rootDir: temp.rootDir }, ["specs"]);
    expect(r.dirty).toBe(false);
  });
});

describe("assertWorkingTreeClean", () => {
  test("throws when unrelated files are dirty", () => {
    temp = makeTempRepo();
    const t = temp;
    writeFileSync(join(t.rootDir, "extra.txt"), "x");
    expect(() => assertWorkingTreeClean({ rootDir: t.rootDir })).toThrow("working_tree_dirty");
  });

  test("permits ignored dirty paths", () => {
    temp = makeTempRepo();
    const t = temp;
    writeFileSync(join(t.rootDir, "specs", "scratch.md"), "x");
    expect(() => assertWorkingTreeClean({ rootDir: t.rootDir }, ["specs"])).not.toThrow();
  });
});

describe("gitAdd + gitCommit", () => {
  test("stages + commits returns sha", () => {
    temp = makeTempRepo();
    writeFileSync(join(temp.rootDir, "new.txt"), "hello");
    gitAdd({ rootDir: temp.rootDir }, ["new.txt"]);
    const sha = gitCommit({ rootDir: temp.rootDir }, "test commit");
    expect(sha).toMatch(/^[a-f0-9]{40}$/);
    const r = gitWorkingTreeDirty({ rootDir: temp.rootDir });
    expect(r.dirty).toBe(false);
  });

  test("gitAdd noop on empty file list", () => {
    temp = makeTempRepo();
    const t = temp;
    expect(() => gitAdd({ rootDir: t.rootDir }, [])).not.toThrow();
  });
});

describe("gitMv", () => {
  test("rename via git mv", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    gitMv({ rootDir: temp.rootDir }, "specs/active/draft-minimal", "specs/done/draft-minimal");
    const lines = gitStatusPorcelain({ rootDir: temp.rootDir });
    const renames = lines.filter((l) => l.startsWith("R "));
    expect(renames.length).toBeGreaterThan(0);
  });
});

describe("gitConfigUserName / Email", () => {
  test("reads configured user from temp repo", () => {
    temp = makeTempRepo();
    expect(gitConfigUserName({ rootDir: temp.rootDir })).toBe("Test Agent");
    expect(gitConfigUserEmail({ rootDir: temp.rootDir })).toBe("test@example.com");
  });

  test("returns '' when -C target does not exist (catch branch)", () => {
    const bogus = join(tmpdir(), `citadel-git-missing-${Date.now()}`);
    expect(gitConfigUserName({ rootDir: bogus })).toBe("");
    expect(gitConfigUserEmail({ rootDir: bogus })).toBe("");
  });
});

describe("gitInit / gitConfigSet / gitRevParseShowToplevel", () => {
  test("gitInit + gitConfigSet wire a usable repo, revparse returns toplevel", () => {
    const scratch = mkdtempSync(join(tmpdir(), "citadel-git-init-"));
    try {
      gitInit(scratch);
      gitConfigSet({ rootDir: scratch }, "user.name", "Init User");
      gitConfigSet({ rootDir: scratch }, "user.email", "init@example.com");
      expect(gitConfigUserName({ rootDir: scratch })).toBe("Init User");
      expect(gitRevParseShowToplevel(scratch)).toBe(scratch);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
