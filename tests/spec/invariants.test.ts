import { describe, expect, test } from "bun:test";
import { checkSlugInCorrectDir, checkSpecTasksStatusAlign } from "../../src/spec/invariants.js";
import { parseSpec, parseTasks } from "../../src/spec/parse.js";
import { loadFixture } from "../fixtures.js";

describe("checkSpecTasksStatusAlign", () => {
  test("aligned status emits no violations", () => {
    const fix = loadFixture("approved-ratified");
    const spec = parseSpec(fix.spec);
    const tasks = parseTasks(fix.tasks);
    expect(checkSpecTasksStatusAlign(spec, tasks)).toEqual([]);
  });

  test("drift between spec.md and tasks.md flagged", () => {
    const fix = loadFixture("draft-minimal");
    const spec = parseSpec(fix.spec);
    const driftedTasksMd = fix.tasks.replace("DRAFT 011900ZMAY26", "IN_PROGRESS 011900ZMAY26");
    const tasks = parseTasks(driftedTasksMd);
    const violations = checkSpecTasksStatusAlign(spec, tasks);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.code).toBe("status_drift");
  });
});

describe("checkSlugInCorrectDir", () => {
  test("DONE spec in done/ passes", () => {
    const fix = loadFixture("done");
    const spec = parseSpec(fix.spec);
    expect(checkSlugInCorrectDir(spec, "done")).toEqual([]);
  });

  test("non-DONE spec in active/ passes", () => {
    const fix = loadFixture("draft-minimal");
    const spec = parseSpec(fix.spec);
    expect(checkSlugInCorrectDir(spec, "active")).toEqual([]);
  });

  test("DONE spec found in active/ flagged as path_mismatch", () => {
    const fix = loadFixture("done");
    const spec = parseSpec(fix.spec);
    const v = checkSlugInCorrectDir(spec, "active");
    expect(v).toHaveLength(1);
    expect(v[0]?.code).toBe("path_mismatch");
  });

  test("PARKED spec in parked/ passes", () => {
    const fix = loadFixture("parked-minimal");
    const spec = parseSpec(fix.spec);
    expect(checkSlugInCorrectDir(spec, "parked")).toEqual([]);
  });

  test("PARKED spec in active/ flagged", () => {
    const fix = loadFixture("parked-minimal");
    const spec = parseSpec(fix.spec);
    const v = checkSlugInCorrectDir(spec, "active");
    expect(v).toHaveLength(1);
    expect(v[0]?.code).toBe("path_mismatch");
  });

  test("DRAFT spec in parked/ flagged", () => {
    const fix = loadFixture("draft-minimal");
    const spec = parseSpec(fix.spec);
    const v = checkSlugInCorrectDir(spec, "parked");
    expect(v).toHaveLength(1);
    expect(v[0]?.code).toBe("path_mismatch");
  });

  test("non-DONE spec found in done/ flagged", () => {
    const fix = loadFixture("draft-minimal");
    const spec = parseSpec(fix.spec);
    const v = checkSlugInCorrectDir(spec, "done");
    expect(v).toHaveLength(1);
    expect(v[0]?.code).toBe("path_mismatch");
  });
});
