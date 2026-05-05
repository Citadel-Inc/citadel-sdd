import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specIndexRebuild } from "../../src/tools/spec_index_rebuild.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn("bastion") };
}

describe("specIndexRebuild", () => {
  test("rebuilds with active, done, and parked tables", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "approved-ratified"],
      doneFixtures: ["done"],
    });
    const out = specIndexRebuild({}, ctx());
    expect(out.active_count).toBe(2);
    expect(out.done_count).toBe(1);
    expect(out.parked_count).toBe(0);
    expect(out.scaffold_repairs).toEqual([]);

    const path = join(temp.rootDir, "specs", "README.md");
    const md = readFileSync(path, "utf8");
    expect(md).toContain("## Active");
    expect(md).toContain("github.com/Rethunk-AI/citadel-sdd");
    expect(md).toContain("@rethunk/citadel-sdd");
    expect(md).toContain("## Done");
    expect(md).toContain("## Parked");
    expect(md).toContain("draft-minimal");
    expect(md).toContain("approved-ratified");
    expect(md).toContain("done");
  });

  test("empty repo emits all tables with placeholders", () => {
    temp = makeTempRepo();
    const out = specIndexRebuild({}, ctx());
    expect(out.active_count).toBe(0);
    expect(out.done_count).toBe(0);
    expect(out.parked_count).toBe(0);
    expect(out.scaffold_repairs).toEqual([]);
    expect(out.rendered).toContain("## Parked");
    expect(out.rendered).toContain("github.com/Rethunk-AI/citadel-sdd");
  });

  test("creates missing bucket dirs before writing README", () => {
    temp = makeTempRepo();
    rmSync(join(temp.rootDir, "specs", "parked"), { recursive: true, force: true });
    const out = specIndexRebuild({}, ctx());
    expect(existsSync(join(temp.rootDir, "specs", "parked", ".gitkeep"))).toBe(true);
    expect(out.scaffold_repairs.length).toBeGreaterThan(0);
  });

  test("dryRun does not write", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const path = join(temp.rootDir, "specs", "README.md");
    const before = readFileSync(path, "utf8");
    const out = specIndexRebuild({ dryRun: true }, ctx());
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(out.scaffold_repairs).toEqual([]);
    expect(readFileSync(path, "utf8")).toBe(before);
  });
});
