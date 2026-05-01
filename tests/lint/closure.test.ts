import { describe, expect, test } from "bun:test";
import { computeClosureReason } from "../../src/lint/closure.js";

describe("computeClosureReason", () => {
  test("uninitialised when no tasks", () => {
    expect(
      computeClosureReason({ open: 0, done: 0, human: 0, hasProgress: false }, { slug: "x" }),
    ).toBe("uninitialised");
  });

  test("open_human takes precedence over open_tasks", () => {
    expect(
      computeClosureReason({ open: 5, done: 1, human: 2, hasProgress: false }, { slug: "x" }),
    ).toBe("open_human");
  });

  test("open_tasks when only non-human open", () => {
    expect(
      computeClosureReason({ open: 3, done: 1, human: 0, hasProgress: false }, { slug: "x" }),
    ).toBe("open_tasks");
  });

  test("progress_file when no open + progress.md present", () => {
    expect(
      computeClosureReason({ open: 0, done: 5, human: 0, hasProgress: true }, { slug: "x" }),
    ).toBe("progress_file");
  });

  test("not_indexed when README has entries but slug missing", () => {
    expect(
      computeClosureReason(
        { open: 0, done: 5, human: 0, hasProgress: false },
        { slug: "x", indexedActive: new Set(["a", "b"]) },
      ),
    ).toBe("not_indexed");
  });

  test("ready when all gates pass", () => {
    expect(
      computeClosureReason(
        { open: 0, done: 5, human: 0, hasProgress: false },
        { slug: "x", indexedActive: new Set(["x", "y"]) },
      ),
    ).toBe("ready");
  });

  test("ready when README empty (no parity check)", () => {
    expect(
      computeClosureReason(
        { open: 0, done: 5, human: 0, hasProgress: false },
        { slug: "x", indexedActive: new Set() },
      ),
    ).toBe("ready");
  });
});
