import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specLint } from "../../src/tools/spec_lint.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let repo: TempRepo;

beforeEach(() => {
  repo = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
});

afterEach(() => {
  repo.cleanup();
});

function ctx(): ToolContext {
  return { rootDir: repo.rootDir, profile: resolveBuiltIn("default") };
}

describe("missing-file lint cats", () => {
  test("emits missing-plan when plan.md absent", () => {
    rmSync(join(repo.rootDir, "specs", "active", "in-progress-midway", "plan.md"));
    const out = specLint({ slug: "in-progress-midway" }, ctx());
    expect(out.findings.some((f) => f.code === "missing-plan")).toBe(true);
  });

  test("emits missing-tasks when tasks.md absent", () => {
    rmSync(join(repo.rootDir, "specs", "active", "in-progress-midway", "tasks.md"));
    const out = specLint({ slug: "in-progress-midway" }, ctx());
    expect(out.findings.some((f) => f.code === "missing-tasks")).toBe(true);
  });

  test("emits progress-file when progress.md present", () => {
    writeFileSync(
      join(repo.rootDir, "specs", "active", "in-progress-midway", "progress.md"),
      "wip\n",
    );
    const out = specLint({ slug: "in-progress-midway" }, ctx());
    expect(out.findings.some((f) => f.code === "progress-file")).toBe(true);
  });

  test("does not emit missing-* for done specs", () => {
    const repo2 = makeTempRepo({ doneFixtures: ["done"] });
    try {
      rmSync(join(repo2.rootDir, "specs", "done", "done", "plan.md"));
      const out = specLint(
        { include_done: true },
        { rootDir: repo2.rootDir, profile: resolveBuiltIn("default") },
      );
      expect(out.findings.some((f) => f.code === "missing-plan")).toBe(false);
    } finally {
      repo2.cleanup();
    }
  });
});
