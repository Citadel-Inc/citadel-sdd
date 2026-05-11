import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

  test("skips spec with unparseable status instead of throwing", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const brokenDir = join(temp.rootDir, "specs", "active", "broken-status");
    mkdirSync(brokenDir, { recursive: true });
    writeFileSync(
      join(brokenDir, "spec.md"),
      "# Spec — broken-status\n\n| | |\n|---|---|\n| Status | **DRAFT** — no DTG token here, just prose |\n",
    );
    writeFileSync(
      join(brokenDir, "tasks.md"),
      "# Tasks — broken-status\n\nStatus: **DRAFT 010000ZJAN26** — test\n\n## P0\n",
    );
    expect(() => specList({}, ctx())).not.toThrow();
    const out = specList({}, ctx());
    expect(out.map((e) => e.slug)).toContain("draft-minimal");
    expect(out.map((e) => e.slug)).not.toContain("broken-status");
  });

  test("default sort by DTG descending", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "in-progress-midway"],
    });
    const out = specList({ state: "all" }, ctx());
    expect(out[0]?.slug).toBe("in-progress-midway");
    expect(out[1]?.slug).toBe("draft-minimal");
  });

  test("entry has tasks.{checked,total} aggregate", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specList({}, ctx());
    expect(out[0]?.tasks).toBeDefined();
    expect(out[0]?.tasks.total).toBe(5);
    expect(out[0]?.tasks.checked).toBe(1);
    expect((out[0]?.tasks.total ?? 0) - (out[0]?.tasks.checked ?? 0)).toBe(
      (out[0]?.p0_remaining ?? 0) + (out[0]?.p1_remaining ?? 0) + (out[0]?.p2_remaining ?? 0),
    );
  });

  test("slim mode returns compact rows", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specList({ slim: true }, ctx());
    expect(out).toHaveLength(1);
    const row = out[0];
    expect(row).toBeDefined();
    if (!row) return;
    expect(Object.keys(row).sort()).toEqual(
      ["slug", "state", "dtg", "owner", "p0", "p1", "p2", "tasks"].sort(),
    );
    expect(row.p0).toBe(2);
    expect(row.tasks.total).toBe(5);
  });

  test("limit + offset paginate sorted entries", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "in-progress-midway", "approved-ratified"],
    });
    const page1 = specList({ state: "all", limit: 2, offset: 0 }, ctx());
    const page2 = specList({ state: "all", limit: 2, offset: 2 }, ctx());
    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(1);
    const slugs = [...page1, ...page2].map((e) => e.slug);
    expect(new Set(slugs).size).toBe(3);
  });

  test("limit=0 returns empty slice", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specList({ limit: 0 }, ctx());
    expect(out).toEqual([]);
  });
});
