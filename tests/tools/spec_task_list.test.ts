import { afterEach, describe, expect, test } from "bun:test";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specTaskList } from "../../src/tools/spec_task_list.js";
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

describe("specTaskList", () => {
  test("returns all items across phases", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskList({ slug: "draft-minimal" }, ctx());
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.total).toBe(out.items.length);
    expect(out.items.every((i) => typeof i.text === "string" && i.text.length > 0)).toBe(true);
    expect(out.items.every((i) => typeof i.checked === "boolean")).toBe(true);
    expect(out.items.every((i) => i.index >= 1)).toBe(true);
  });

  test("index is 1-based and sequential per phase", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskList({ slug: "draft-minimal" }, ctx());
    for (const phase of ["P0", "P1", "P2"] as const) {
      const phaseItems = out.items.filter((i) => i.phase === phase);
      phaseItems.forEach((item, pos) => {
        expect(item.index).toBe(pos + 1);
      });
    }
  });

  test("phases filter restricts output to requested phases", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskList({ slug: "draft-minimal", phases: ["P0"] }, ctx());
    expect(out.items.every((i) => i.phase === "P0")).toBe(true);
  });

  test("unchecked count is accurate", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const out = specTaskList({ slug: "in-progress-midway" }, ctx());
    const actualUnchecked = out.items.filter((i) => !i.checked).length;
    expect(out.unchecked).toBe(actualUnchecked);
  });

  test("isHumanGate flagged correctly", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specTaskList({ slug: "draft-minimal" }, ctx());
    const gates = out.items.filter((i) => i.isHumanGate);
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.every((i) => i.text.includes("[HUMAN]"))).toBe(true);
  });

  test("done fixture — all items checked, unchecked=0", () => {
    temp = makeTempRepo({ activeFixtures: ["done"] });
    const out = specTaskList({ slug: "done" }, ctx());
    expect(out.unchecked).toBe(0);
    expect(out.items.every((i) => i.checked)).toBe(true);
  });

  test("spec_not_found throws for unknown slug", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specTaskList({ slug: "no-such-spec" }, ctx())).toThrow("spec_not_found");
  });
});
