import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specTaskCheck } from "../../src/tools/spec_task_check.js";
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

describe("specTaskCheck", () => {
  test("check by 1-based index", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskCheck(
      { slug: "draft-minimal", phase: "P0", match: 2, checked: true },
      ctx(),
    );
    expect(out.before.checked).toBe(false);
    expect(out.after.checked).toBe(true);
    const tasks = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("- [x] First task");
  });

  test("check by text-prefix match", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    specTaskCheck({ slug: "draft-minimal", phase: "P0", match: "First", checked: true }, ctx());
    const tasks = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("- [x] First task");
  });

  test("uncheck flips x → space", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const out = specTaskCheck(
      { slug: "in-progress-midway", phase: "P0", match: "Scaffold", checked: false },
      ctx(),
    );
    expect(out.before.checked).toBe(true);
    expect(out.after.checked).toBe(false);
  });

  test("dryRun no write", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const path = join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md");
    const before = readFileSync(path, "utf8");
    specTaskCheck(
      { slug: "draft-minimal", phase: "P0", match: 1, checked: true, dryRun: true },
      ctx(),
    );
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("task_not_found throws when match misses", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() =>
      specTaskCheck({ slug: "draft-minimal", phase: "P0", match: "ZZZ", checked: true }, ctx()),
    ).toThrow("task_not_found");
  });

  test("out-of-range index throws", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() =>
      specTaskCheck({ slug: "draft-minimal", phase: "P0", match: 99, checked: true }, ctx()),
    ).toThrow("task_not_found");
  });
});
