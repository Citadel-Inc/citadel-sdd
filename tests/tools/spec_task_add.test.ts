import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specTaskAdd } from "../../src/tools/spec_task_add.js";
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

describe("specTaskAdd", () => {
  test("appends to P1", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskAdd({ slug: "draft-minimal", phase: "P1", text: "New polish item" }, ctx());
    expect(out.added_index).toBe(2);
    const tasks = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("- [ ] New polish item");
  });

  test("blocker:true adds [BLOCKED] prefix", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    specTaskAdd(
      { slug: "draft-minimal", phase: "P0", text: "Wait for upstream", blocker: true },
      ctx(),
    );
    const tasks = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md"),
      "utf8",
    );
    expect(tasks).toContain("- [ ] [BLOCKED] Wait for upstream");
  });

  test("dryRun no write", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const path = join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md");
    const before = readFileSync(path, "utf8");
    specTaskAdd({ slug: "draft-minimal", phase: "P0", text: "ghost", dryRun: true }, ctx());
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("unknown slug throws", () => {
    temp = makeTempRepo();
    expect(() => specTaskAdd({ slug: "missing", phase: "P0", text: "x" }, ctx())).toThrow(
      "spec_not_found",
    );
  });
});
