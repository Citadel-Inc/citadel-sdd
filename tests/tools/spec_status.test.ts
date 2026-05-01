import { afterEach, describe, expect, test } from "bun:test";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specStatus } from "../../src/tools/spec_status.js";
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

describe("specStatus", () => {
  test("returns full status snapshot", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const s = specStatus({ slug: "approved-ratified" }, ctx());
    expect(s.state).toBe("APPROVED");
    expect(s.dtg).toBe("011910ZMAY26");
    expect(s.owner).toBe("TestAgent");
    expect(s.approved_dtg).toBe("011910ZMAY26");
    expect(s.ratified).toBe(true);
    expect(s.q_table).toHaveLength(3);
  });

  test("task_counts reflect open/done split", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const s = specStatus({ slug: "in-progress-midway" }, ctx());
    expect(s.task_counts.P0.done).toBe(3);
    expect(s.task_counts.P0.open).toBe(2);
    expect(s.task_counts.P1.done).toBe(1);
    expect(s.task_counts.P1.open).toBe(1);
  });

  test("BLOCKED spec surfaces blocker reason from status tail", () => {
    temp = makeTempRepo({ activeFixtures: ["blocked-reason"] });
    const s = specStatus({ slug: "blocked-reason" }, ctx());
    expect(s.state).toBe("BLOCKED");
    expect(s.blockers).toContain("awaiting external dependency");
  });

  test("ratified=false when Q-table empty", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const s = specStatus({ slug: "draft-minimal" }, ctx());
    expect(s.ratified).toBe(false);
  });

  test("approved_dtg=null when Approved=TBD", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const s = specStatus({ slug: "draft-minimal" }, ctx());
    expect(s.approved_dtg).toBeNull();
  });

  test("unknown slug throws", () => {
    temp = makeTempRepo();
    expect(() => specStatus({ slug: "missing" }, ctx())).toThrow("spec_not_found");
  });
});
