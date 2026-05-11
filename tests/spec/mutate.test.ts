import { describe, expect, test } from "bun:test";
import { findTaskIndex, resolveTaskMatch, setTaskChecked } from "../../src/spec/mutate.js";
import { parseTasks } from "../../src/spec/parse.js";

const TASKS = parseTasks(
  `# T\n\n| | |\n|---|---|\n| Status | IN_PROGRESS 011900ZMAY26 |\n\n## P0\n\n- [ ] First task\n- [ ] Second task\n\n## P1\n\n## P2\n`,
);

describe("task match + mutate", () => {
  test("findTaskIndex covers numeric in-range, numeric out-of-range, prefix hit, prefix miss", () => {
    expect(findTaskIndex(TASKS, { phase: "P0", match: 1 })).toBe(0);
    expect(findTaskIndex(TASKS, { phase: "P0", match: 2 })).toBe(1);
    expect(findTaskIndex(TASKS, { phase: "P0", match: 0 })).toBe(-1);
    expect(findTaskIndex(TASKS, { phase: "P0", match: 99 })).toBe(-1);
    expect(findTaskIndex(TASKS, { phase: "P0", match: "Second" })).toBe(1);
    expect(findTaskIndex(TASKS, { phase: "P0", match: "Nonexistent" })).toBe(-1);
  });

  test("resolveTaskMatch returns idx+text on hit, null on miss", () => {
    expect(resolveTaskMatch(TASKS, { phase: "P0", match: 1 })).toEqual({
      idx: 0,
      text: "First task",
    });
    expect(resolveTaskMatch(TASKS, { phase: "P0", match: "Nope" })).toBeNull();
  });

  test("setTaskChecked flips flag; throws task_not_found with available-text preview", () => {
    const out = setTaskChecked(TASKS, { phase: "P0", match: 1 }, true);
    expect(out.phases.P0[0]?.checked).toBe(true);
    expect(out.phases.P0[1]?.checked).toBe(false);

    expect(() => setTaskChecked(TASKS, { phase: "P0", match: "Ghost" }, true)).toThrow(
      /task_not_found.*First task.*Second task/s,
    );
    // Empty phase: error fires without preview tail.
    expect(() => setTaskChecked(TASKS, { phase: "P1", match: 1 }, true)).toThrow("task_not_found");
  });
});
