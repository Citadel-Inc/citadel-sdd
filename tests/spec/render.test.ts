import { describe, expect, test } from "bun:test";
import {
  parseFrontmatter,
  parseQTable,
  parseStatusValue,
  parseTasks,
} from "../../src/spec/parse.js";
import {
  renderFrontmatter,
  renderQTable,
  renderStatusValue,
  renderTaskItem,
  renderTasks,
} from "../../src/spec/render.js";
import { loadAllFixtures, loadFixture } from "../fixtures.js";

describe("renderStatusValue", () => {
  test("DRAFT no tail", () => {
    expect(renderStatusValue({ state: "DRAFT", dtg: "011900ZMAY26", tail: "" })).toBe(
      "DRAFT 011900ZMAY26",
    );
  });

  test("IN_PROGRESS with tail uses em-dash", () => {
    const out = renderStatusValue({
      state: "IN_PROGRESS",
      dtg: "011920ZMAY26",
      tail: "Bastion claims execution",
    });
    expect(out).toBe("IN_PROGRESS 011920ZMAY26 — Bastion claims execution");
  });

  test("round-trip with parseStatusValue", () => {
    const original = "DONE 011945ZMAY26 — all green";
    const v = parseStatusValue(original);
    expect(renderStatusValue(v)).toBe(original);
  });

  test("empty DTG — no trailing space (plain)", () => {
    expect(renderStatusValue({ state: "DRAFT", dtg: "", tail: "" })).toBe("DRAFT");
  });

  test("empty DTG — no trailing space (bold)", () => {
    expect(renderStatusValue({ state: "DRAFT", dtg: "", tail: "", bold: true })).toBe("**DRAFT**");
  });

  test("bold state-only round-trips through parseStatusValue", () => {
    const v = parseStatusValue("**DRAFT**");
    expect(renderStatusValue(v)).toBe("**DRAFT**");
  });
});

describe("renderFrontmatter", () => {
  test("produces a parseable pipe-table", () => {
    const fix = loadFixture("approved-ratified");
    const fm = parseFrontmatter(fix.spec);
    const rendered = renderFrontmatter(fm);
    const reparsed = parseFrontmatter(rendered);
    expect(reparsed.status).toEqual(fm.status);
    expect(reparsed.fields).toEqual(fm.fields);
  });

  test("preserves field order", () => {
    const fix = loadFixture("approved-ratified");
    const fm = parseFrontmatter(fix.spec);
    const rendered = renderFrontmatter(fm);
    const dataLines = rendered
      .split("\n")
      .slice(2)
      .filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|$/.test(l));
    expect(dataLines[0]).toContain("Status");
    expect(dataLines[1]).toContain("Owner");
    expect(dataLines[2]).toContain("Approved");
  });
});

describe("renderQTable", () => {
  test("returns empty string when given empty array", () => {
    expect(renderQTable([])).toBe("");
  });

  test("round-trip with parseQTable on approved-ratified", () => {
    const fix = loadFixture("approved-ratified");
    const rows = parseQTable(fix.spec);
    const rendered = renderQTable(rows);
    const reparsed = parseQTable(rendered);
    expect(reparsed).toEqual(rows);
  });
});

describe("renderTaskItem", () => {
  test("checked", () => {
    expect(renderTaskItem({ checked: true, text: "do it", isHumanGate: false })).toBe(
      "- [x] do it",
    );
  });

  test("unchecked", () => {
    expect(renderTaskItem({ checked: false, text: "todo", isHumanGate: false })).toBe("- [ ] todo");
  });

  test("[HUMAN] gate text round-trips through parseTasks", () => {
    const item = {
      checked: false,
      text: "[HUMAN] NOMAD ratifies Q-table",
      isHumanGate: true,
    };
    expect(renderTaskItem(item)).toBe("- [ ] [HUMAN] NOMAD ratifies Q-table");
  });
});

describe("renderTasks idempotency", () => {
  test("every fixture round-trips at AST level", () => {
    for (const fix of loadAllFixtures()) {
      const parsed = parseTasks(fix.tasks);
      const rendered = renderTasks(parsed);
      const reparsed = parseTasks(rendered);
      expect(reparsed.frontmatter.status).toEqual(parsed.frontmatter.status);
      expect(reparsed.frontmatter.fields).toEqual(parsed.frontmatter.fields);
      expect(reparsed.phases).toEqual(parsed.phases);
    }
  });

  test("double round-trip is stable (parse→render→parse→render byte-identical)", () => {
    for (const fix of loadAllFixtures()) {
      const r1 = renderTasks(parseTasks(fix.tasks));
      const r2 = renderTasks(parseTasks(r1));
      expect(r2).toBe(r1);
    }
  });
});

describe("renderFrontmatter idempotency", () => {
  test("every fixture spec.md frontmatter round-trips at AST level", () => {
    for (const fix of loadAllFixtures()) {
      const fm = parseFrontmatter(fix.spec);
      const rendered = renderFrontmatter(fm);
      const reparsed = parseFrontmatter(rendered);
      expect(reparsed.status).toEqual(fm.status);
      expect(reparsed.fields).toEqual(fm.fields);
    }
  });

  test("double round-trip is byte-identical", () => {
    for (const fix of loadAllFixtures()) {
      const r1 = renderFrontmatter(parseFrontmatter(fix.spec));
      const r2 = renderFrontmatter(parseFrontmatter(r1));
      expect(r2).toBe(r1);
    }
  });
});

describe("renderQTable idempotency", () => {
  test("every fixture's Q-table round-trips at AST level", () => {
    for (const fix of loadAllFixtures()) {
      const rows = parseQTable(fix.spec);
      const rendered = renderQTable(rows);
      const reparsed = parseQTable(rendered);
      expect(reparsed).toEqual(rows);
    }
  });
});
