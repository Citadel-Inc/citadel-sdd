import { afterEach, describe, expect, test } from "bun:test";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specList } from "../../src/tools/spec_list.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(principal?: string): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return {
    rootDir: temp.rootDir,
    profile: resolveBuiltIn("default"),
    principal,
  };
}

describe("specList", () => {
  test("default state=active", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "in-progress-midway"],
      doneFixtures: ["done"],
    });
    const out = specList({}, ctx());
    expect(out.map((e) => e.slug).sort()).toEqual(["draft-minimal", "in-progress-midway"]);
  });

  test("state=all returns active + done", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal"],
      doneFixtures: ["done"],
    });
    const out = specList({ state: "all" }, ctx());
    expect(out.map((e) => e.slug).sort()).toEqual(["done", "draft-minimal"]);
  });

  test("state=blocked filters to BLOCKED specs only", () => {
    temp = makeTempRepo({ activeFixtures: ["blocked-reason", "draft-minimal"] });
    const out = specList({ state: "blocked" }, ctx());
    expect(out).toHaveLength(1);
    expect(out[0]?.slug).toBe("blocked-reason");
    expect(out[0]?.state).toBe("BLOCKED");
  });

  test("entry has owner + ratified + remaining counts", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specList({}, ctx());
    expect(out[0]?.owner).toBe("TestAgent");
    expect(out[0]?.ratified).toBe(true);
    expect(out[0]?.p0_remaining).toBe(2);
    expect(out[0]?.p1_remaining).toBe(1);
    expect(out[0]?.p2_remaining).toBe(1);
  });

  test("ratified=false when Q-table has TBD or empty", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specList({}, ctx());
    expect(out[0]?.ratified).toBe(false);
  });

  test("mine filter requires principal match on Owner field", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "approved-ratified"],
    });
    const all = specList({ mine: true }, ctx("TestAgent"));
    expect(all.map((e) => e.slug).sort()).toEqual(["approved-ratified", "draft-minimal"]);

    const none = specList({ mine: true }, ctx("OtherAgent"));
    expect(none).toEqual([]);
  });

  test("mine without principal returns all (no filter)", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specList({ mine: true }, ctx());
    expect(out).toHaveLength(1);
  });

  test("default sort by DTG descending", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "in-progress-midway"],
    });
    const out = specList({ state: "all" }, ctx());
    expect(out[0]?.slug).toBe("in-progress-midway");
    expect(out[1]?.slug).toBe("draft-minimal");
  });
});
