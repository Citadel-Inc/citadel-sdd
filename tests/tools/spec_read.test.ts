import { afterEach, describe, expect, test } from "bun:test";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specRead } from "../../src/tools/spec_read.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn("default") };
}

describe("specRead", () => {
  test("default returns all three parts + frontmatter", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specRead({ slug: "approved-ratified" }, ctx());
    expect(out.slug).toBe("approved-ratified");
    expect(out.state).toBe("active");
    expect(out.spec_md).toContain("APPROVED");
    expect(out.plan_md).toContain("Phase 1");
    expect(out.tasks_md).toContain("[HUMAN]");
    expect(out.frontmatter.status.state).toBe("APPROVED");
  });

  test("parts:[spec] returns only spec_md", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specRead({ slug: "draft-minimal", parts: ["spec"] }, ctx());
    expect(out.spec_md).not.toBeNull();
    expect(out.plan_md).toBeNull();
    expect(out.tasks_md).toBeNull();
  });

  test("done fixture readable from done/ dir", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    const out = specRead({ slug: "done" }, ctx());
    expect(out.state).toBe("done");
  });

  test("unknown slug throws spec_not_found", () => {
    temp = makeTempRepo();
    expect(() => specRead({ slug: "missing" }, ctx())).toThrow("spec_not_found");
  });
});
