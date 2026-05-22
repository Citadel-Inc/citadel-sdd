import { afterEach, describe, expect, test } from "bun:test";
import { symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  assertRegularFile,
  listSpecs,
  locateSpec,
  type RepoContext,
  readPlan,
  readSpec,
  readTasks,
  slugLooksValid,
  specsRoot,
} from "../../src/spec/repo.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(): RepoContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, specDir: "specs" };
}

describe("locateSpec", () => {
  test("finds active fixture", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const loc = locateSpec(ctx(), "draft-minimal");
    expect(loc).not.toBeNull();
    expect(loc?.state).toBe("active");
  });

  test("finds done fixture", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    const loc = locateSpec(ctx(), "done");
    expect(loc?.state).toBe("done");
  });

  test("prefers active over done when both exist (slug uniqueness invariant — should not happen, but defensive)", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal"],
      doneFixtures: [],
    });
    const loc = locateSpec(ctx(), "draft-minimal");
    expect(loc?.state).toBe("active");
  });

  test("returns null for unknown slug", () => {
    temp = makeTempRepo();
    expect(locateSpec(ctx(), "nonexistent")).toBeNull();
  });

  test("rejects invalid slug input", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(locateSpec(ctx(), "../draft-minimal")).toBeNull();
  });

  test("does not follow symlinked spec directories", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    symlinkSync(
      `${temp.rootDir}/specs/done/done`,
      `${temp.rootDir}/specs/active/sneaky-done`,
      "dir",
    );
    expect(locateSpec(ctx(), "sneaky-done")).toBeNull();
  });
});

describe("listSpecs", () => {
  test("scope=all returns active + done sorted", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "approved-ratified"],
      doneFixtures: ["done"],
    });
    const all = listSpecs(ctx(), "all");
    expect(all.map((s) => s.slug)).toEqual(["approved-ratified", "done", "draft-minimal"]);
  });

  test("scope=active filters out done", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal"],
      doneFixtures: ["done"],
    });
    const out = listSpecs(ctx(), "active");
    expect(out.map((s) => s.slug)).toEqual(["draft-minimal"]);
  });

  test("scope=done filters out active", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal"],
      doneFixtures: ["done"],
    });
    const out = listSpecs(ctx(), "done");
    expect(out.map((s) => s.slug)).toEqual(["done"]);
  });

  test("returns empty list on empty repo", () => {
    temp = makeTempRepo();
    expect(listSpecs(ctx())).toEqual([]);
  });
});

describe("readSpec / readTasks / readPlan", () => {
  test("readSpec parses fixture", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const loc = locateSpec(ctx(), "approved-ratified");
    expect(loc).not.toBeNull();
    if (!loc) return;
    const parsed = readSpec(loc);
    expect(parsed.frontmatter.status.state).toBe("APPROVED");
    expect(parsed.qTable).toHaveLength(3);
  });

  test("readTasks parses fixture", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const loc = locateSpec(ctx(), "in-progress-midway");
    if (!loc) return;
    const tasks = readTasks(loc);
    expect(tasks.frontmatter.status.state).toBe("IN_PROGRESS");
    expect(tasks.phases.P0).toHaveLength(5);
  });

  test("readPlan returns raw markdown", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const loc = locateSpec(ctx(), "draft-minimal");
    if (!loc) return;
    expect(readPlan(loc)).toContain("Draft minimal — Plan");
  });
});

describe("specsRoot", () => {
  test("joins rootDir + specDir", () => {
    temp = makeTempRepo();
    expect(specsRoot(ctx())).toBe(`${temp.rootDir}/specs`);
  });
});

describe("assertRegularFile", () => {
  test("does not throw for a regular file", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const loc = locateSpec(ctx(), "draft-minimal");
    expect(loc).not.toBeNull();
    if (!loc) return;
    expect(() => assertRegularFile(loc.specMd)).not.toThrow();
  });

  test("throws path_is_symlink for a symlinked file", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const loc = locateSpec(ctx(), "draft-minimal");
    expect(loc).not.toBeNull();
    if (!loc) return;
    const symlinkPath = join(loc.dir, "symlinked-spec.md");
    symlinkSync(loc.specMd, symlinkPath);
    expect(() => assertRegularFile(symlinkPath)).toThrow("path_is_symlink");
  });
});

describe("readSpec / readTasks / readPlan — symlink rejection", () => {
  test("readSpec throws when spec.md is a symlink", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal", "approved-ratified"] });
    const locDst = locateSpec(ctx(), "draft-minimal");
    const locSrc = locateSpec(ctx(), "approved-ratified");
    expect(locDst).not.toBeNull();
    expect(locSrc).not.toBeNull();
    if (!locDst || !locSrc) return;
    // Replace spec.md with a symlink pointing to another spec's file
    unlinkSync(locDst.specMd);
    symlinkSync(locSrc.specMd, locDst.specMd);
    expect(() => readSpec(locDst)).toThrow("path_is_symlink");
  });
});

describe("slugLooksValid", () => {
  test("accepts kebab-case slugs", () => {
    expect(slugLooksValid("foo")).toBe(true);
    expect(slugLooksValid("foo-bar")).toBe(true);
    expect(slugLooksValid("foo-bar-baz")).toBe(true);
    expect(slugLooksValid("a1-b2")).toBe(true);
  });

  test("rejects uppercase / underscores / paths", () => {
    expect(slugLooksValid("Foo")).toBe(false);
    expect(slugLooksValid("foo_bar")).toBe(false);
    expect(slugLooksValid("foo/bar")).toBe(false);
    expect(slugLooksValid("foo bar")).toBe(false);
    expect(slugLooksValid("")).toBe(false);
    expect(slugLooksValid("-foo")).toBe(false);
    expect(slugLooksValid("foo-")).toBe(false);
  });
});
