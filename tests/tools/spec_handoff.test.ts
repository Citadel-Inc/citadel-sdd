import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specHandoff } from "../../src/tools/spec_handoff.js";
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

describe("specHandoff", () => {
  test("changes Owner, leaves state untouched", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const out = specHandoff({ slug: "in-progress-midway", new_owner: "OtherAgent" }, ctx());
    expect(out.before_owner).toBe("TestAgent");
    expect(out.after_owner).toBe("OtherAgent");
    const md = readFileSync(
      join(temp.rootDir, "specs", "active", "in-progress-midway", "spec.md"),
      "utf8",
    );
    expect(md).toContain("| Owner | OtherAgent |");
    expect(md).toContain("IN_PROGRESS 011920ZMAY26");
  });

  test("dryRun no write", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const path = join(temp.rootDir, "specs", "active", "in-progress-midway", "spec.md");
    const before = readFileSync(path, "utf8");
    specHandoff({ slug: "in-progress-midway", new_owner: "OtherAgent", dryRun: true }, ctx());
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("unknown slug throws", () => {
    temp = makeTempRepo();
    expect(() => specHandoff({ slug: "missing", new_owner: "x" }, ctx())).toThrow("spec_not_found");
  });
});
