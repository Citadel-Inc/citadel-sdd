import { describe, expect, test } from "bun:test";
import {
  parseFrontmatter,
  parseQTable,
  parseSpec,
  parseStatusValue,
  parseTasks,
} from "../../src/spec/parse.js";
import { loadAllFixtures, loadFixture } from "../fixtures.js";

describe("parseStatusValue", () => {
  test("DRAFT minimal — no tail", () => {
    const v = parseStatusValue("DRAFT 011900ZMAY26");
    expect(v.state).toBe("DRAFT");
    expect(v.dtg).toBe("011900ZMAY26");
    expect(v.tail).toBe("");
  });

  test("IN_PROGRESS with em-dash tail", () => {
    const v = parseStatusValue("IN_PROGRESS 011920ZMAY26 — Bastion claims execution");
    expect(v.state).toBe("IN_PROGRESS");
    expect(v.dtg).toBe("011920ZMAY26");
    expect(v.tail).toBe("Bastion claims execution");
  });

  test("DONE with ASCII hyphen tail", () => {
    const v = parseStatusValue("DONE 011945ZMAY26 - all green");
    expect(v.state).toBe("DONE");
    expect(v.tail).toBe("all green");
  });

  test("rejects unknown state", () => {
    expect(() => parseStatusValue("FOO 011900ZMAY26")).toThrow("state_unknown");
  });

  test("rejects unparseable input", () => {
    expect(() => parseStatusValue("not-a-status-value")).toThrow("status_unparseable");
  });
});

describe("parseFrontmatter", () => {
  test("extracts Status + Owner from draft-minimal", () => {
    const fix = loadFixture("draft-minimal");
    const fm = parseFrontmatter(fix.spec);
    expect(fm.status.state).toBe("DRAFT");
    expect(fm.status.dtg).toBe("011900ZMAY26");
    const owner = fm.fields.find(([k]) => k === "Owner");
    expect(owner?.[1]).toBe("TestAgent");
  });

  test("preserves field order", () => {
    const fix = loadFixture("approved-ratified");
    const fm = parseFrontmatter(fix.spec);
    const keys = fm.fields.map(([k]) => k);
    expect(keys).toEqual(["Status", "Owner", "Approved"]);
  });

  test("throws when Status field is missing", () => {
    const md = "# X\n\n| | |\n|---|---|\n| Owner | foo |\n";
    expect(() => parseFrontmatter(md)).toThrow("frontmatter_status_missing");
  });

  test("throws when no frontmatter table", () => {
    const md = "# X\n\nNo table here.\n";
    expect(() => parseFrontmatter(md)).toThrow("frontmatter_missing");
  });
});

describe("parseQTable", () => {
  test("returns empty array for spec with empty Q-table", () => {
    const fix = loadFixture("draft-minimal");
    expect(parseQTable(fix.spec)).toEqual([]);
  });

  test("returns empty array for spec without any Q-table", () => {
    const fix = loadFixture("no-qtable");
    expect(parseQTable(fix.spec)).toEqual([]);
  });

  test("parses three ratified rows from approved-ratified", () => {
    const fix = loadFixture("approved-ratified");
    const rows = parseQTable(fix.spec);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.id).toBe("Q1");
    expect(rows[0]?.question).toBe("Use TS?");
    expect(rows[0]?.proposedDefault).toBe("Yes");
    expect(rows[0]?.ratified).toBe("Ratified 011910ZMAY26");
  });

  test("parses two rows from in-progress-midway", () => {
    const fix = loadFixture("in-progress-midway");
    const rows = parseQTable(fix.spec);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ratified.startsWith("Ratified"))).toBe(true);
  });
});

describe("parseSpec", () => {
  test("loads all fixtures without throwing", () => {
    const all = loadAllFixtures();
    expect(all.length).toBeGreaterThan(0);
    for (const fix of all) {
      const parsed = parseSpec(fix.spec);
      expect(parsed.frontmatter.status.state).toBeDefined();
      expect(parsed.raw).toBe(fix.spec);
    }
  });
});

describe("parseTasks", () => {
  test("draft-minimal has 2 P0 + 1 P1 + 1 P2 items", () => {
    const fix = loadFixture("draft-minimal");
    const t = parseTasks(fix.tasks);
    expect(t.phases.P0).toHaveLength(2);
    expect(t.phases.P1).toHaveLength(1);
    expect(t.phases.P2).toHaveLength(1);
  });

  test("first P0 row is the [HUMAN] gate", () => {
    const fix = loadFixture("draft-minimal");
    const t = parseTasks(fix.tasks);
    expect(t.phases.P0[0]?.isHumanGate).toBe(true);
    expect(t.phases.P0[0]?.checked).toBe(false);
  });

  test("in-progress-midway has 3 of 5 P0 checked", () => {
    const fix = loadFixture("in-progress-midway");
    const t = parseTasks(fix.tasks);
    expect(t.phases.P0).toHaveLength(5);
    const checked = t.phases.P0.filter((i) => i.checked).length;
    expect(checked).toBe(3);
  });

  test("done fixture has every box checked", () => {
    const fix = loadFixture("done");
    const t = parseTasks(fix.tasks);
    const all = [...t.phases.P0, ...t.phases.P1, ...t.phases.P2];
    expect(all.every((i) => i.checked)).toBe(true);
  });

  test("status flows from frontmatter on tasks.md", () => {
    const fix = loadFixture("blocked-reason");
    const t = parseTasks(fix.tasks);
    expect(t.frontmatter.status.state).toBe("BLOCKED");
  });

  test("recognises uppercase X in checkbox", () => {
    const md = `# T

| | |
|---|---|
| Status | DONE 011945ZMAY26 |

## P0

- [X] Capital X variant
- [x] Lower x variant
- [ ] Not checked
`;
    const t = parseTasks(md);
    expect(t.phases.P0).toHaveLength(3);
    expect(t.phases.P0[0]?.checked).toBe(true);
    expect(t.phases.P0[1]?.checked).toBe(true);
    expect(t.phases.P0[2]?.checked).toBe(false);
  });

  test("ignores task-like lines outside P0/P1/P2 sections", () => {
    const md = `# T

| | |
|---|---|
| Status | DRAFT 011900ZMAY26 |

## Notes

- [ ] not a task

## P0

- [ ] real task
`;
    const t = parseTasks(md);
    expect(t.phases.P0).toHaveLength(1);
    expect(t.phases.P0[0]?.text).toBe("real task");
  });
});
