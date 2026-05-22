import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "../../src/spec/parse.js";
import { spliceFrontmatter, spliceQTable } from "../../src/spec/writer.js";

const MINIMAL_FM = parseFrontmatter(
  "| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | TestAgent |",
);

describe("spliceFrontmatter — pipe-table file", () => {
  test("replaces existing pipe-table in place", () => {
    const raw = "# Spec\n\n| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n\n## Body\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "any");
    expect(out).toContain("| Status | DRAFT 011900ZMAY26 |");
    expect(out).toContain("## Body");
    expect(out.indexOf("| Status |")).toBeLessThan(out.indexOf("## Body"));
  });

  test("updated status appears in output", () => {
    const raw = "# Spec\n\n| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n";
    const updated = parseFrontmatter("| | |\n|---|---|\n| Status | IN_PROGRESS 011930ZMAY26 |");
    const out = spliceFrontmatter(raw, updated, "any");
    expect(out).toContain("IN_PROGRESS 011930ZMAY26");
    expect(out).not.toContain("DRAFT 011900ZMAY26");
  });
});

describe("spliceFrontmatter — no frontmatter (insert path)", () => {
  test("inserts pipe-table after title when no frontmatter exists (format=any)", () => {
    const raw = "# Tasks\n\n## P0\n- [ ] task one\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "any");
    const lines = out.split("\n");
    const titleIdx = lines.findIndex((l) => l.startsWith("# "));
    const tableIdx = lines.findIndex((l) => l.includes("| Status |"));
    const p0Idx = lines.findIndex((l) => l.startsWith("## P0"));
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(tableIdx).toBeGreaterThan(titleIdx);
    expect(p0Idx).toBeGreaterThan(tableIdx);
  });

  test("inserts pipe-table after title when no frontmatter exists (format=pipe-table)", () => {
    const raw = "# Tasks\n\n## P0\n- [ ] task one\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "pipe-table");
    expect(out).toContain("| Status | DRAFT 011900ZMAY26 |");
    expect(out.indexOf("| Status |")).toBeLessThan(out.indexOf("## P0"));
    expect(out.indexOf("# Tasks")).toBeLessThan(out.indexOf("| Status |"));
  });

  test("inserts inline frontmatter after title when format=inline and no frontmatter", () => {
    const raw = "# Tasks\n\n## P0\n- [ ] task one\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "inline");
    expect(out).toContain("Status: DRAFT 011900ZMAY26");
    expect(out).not.toContain("| Status |");
    expect(out.indexOf("# Tasks")).toBeLessThan(out.indexOf("Status:"));
    expect(out.indexOf("Status:")).toBeLessThan(out.indexOf("## P0"));
  });
});

describe("spliceFrontmatter — format conversion", () => {
  test("inline→pipe-table: inserts pipe-table after title, strips old inline keys", () => {
    const raw = "# Tasks\n\nStatus: DRAFT 011900ZMAY26\nOwner: TestAgent\n\n## P0\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "pipe-table");
    expect(out).toContain("| Status | DRAFT 011900ZMAY26 |");
    expect(out).not.toMatch(/^Status:/m);
    expect(out.indexOf("# Tasks")).toBeLessThan(out.indexOf("| Status |"));
    expect(out.indexOf("| Status |")).toBeLessThan(out.indexOf("## P0"));
  });

  test("pipe-table→inline: replaces pipe block with key-value lines", () => {
    const raw =
      "# Tasks\n\n| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | TestAgent |\n\n## P0\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "inline");
    expect(out).toContain("Status: DRAFT 011900ZMAY26");
    expect(out).not.toContain("| Status |");
    expect(out.indexOf("# Tasks")).toBeLessThan(out.indexOf("Status:"));
  });
});

describe("spliceFrontmatter — inline→pipe strips only frontmatter region", () => {
  test("prose line shaped 'Word: value' in body is preserved during inline→pipe conversion", () => {
    const raw =
      "# Spec\n\nStatus: DRAFT 011900ZMAY26\nOwner: TestAgent\n\n## Body\n\nNote: this is prose that should not be stripped.\n";
    const fm = parseFrontmatter(
      "| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | TestAgent |",
    );
    const out = spliceFrontmatter(raw, fm, "pipe-table");
    // The pipe-table should be inserted, inline keys stripped from frontmatter region
    expect(out).toContain("| Status | DRAFT 011900ZMAY26 |");
    expect(out).not.toMatch(/^Status:/m);
    // But body prose should survive
    expect(out).toContain("Note: this is prose that should not be stripped.");
  });
});

describe("spliceFrontmatter — empty DTG", () => {
  test("bold state-only status renders without trailing space", () => {
    const fmBold = parseFrontmatter("| | |\n|---|---|\n| Status | **DRAFT** |");
    const raw = "# Spec\n\n| | |\n|---|---|\n| Status | **DRAFT** |\n";
    const out = spliceFrontmatter(raw, fmBold, "any");
    expect(out).toContain("| Status | **DRAFT** |");
    expect(out).not.toContain("| Status | **DRAFT ** |");
    expect(out).not.toContain("| Status | **DRAFT**  |");
  });
});

describe("spliceQTable", () => {
  const row = {
    id: "Q1",
    question: "Use TS?",
    proposedDefault: "Yes",
    ratified: "Ratified 011945ZMAY26",
  };

  test("replaces Q-table rows in place", () => {
    const raw =
      "# S\n\n## Decisions\n\n| # | Question | Proposed default | NOMAD |\n|---|---|---|---|\n| Q1 | Use TS? | Yes | TBD |\n\n## Next\n";
    const out = spliceQTable(raw, [row]);
    expect(out).toContain("| Q1 | Use TS? | Yes | Ratified 011945ZMAY26 |");
    expect(out).not.toContain("| TBD |");
    expect(out).toContain("## Next");
  });

  test("no Q-table anchor + zero new rows is a no-op", () => {
    const raw = "# S\n\n## Body\nNo decisions section here.\n";
    expect(spliceQTable(raw, [])).toBe(raw);
  });

  test("no Q-table anchor + non-empty rows throws qtable_anchor_missing", () => {
    const raw = "# S\n\n## Body\nNo decisions section.\n";
    expect(() => spliceQTable(raw, [row])).toThrow("qtable_anchor_missing");
  });

  test("replaces Q-table rows when 4th column is renamed (not 'nomad')", () => {
    const raw =
      "# S\n\n## Decisions\n\n| # | Question | Proposed default | Disposition |\n|---|---|---|---|\n| Q1 | Use TS? | Yes | TBD |\n\n## Next\n";
    const out = spliceQTable(raw, [row]);
    expect(out).toContain("| Q1 | Use TS? | Yes | Ratified 011945ZMAY26 |");
    expect(out).not.toContain("| TBD |");
    expect(out).toContain("## Next");
  });
});
