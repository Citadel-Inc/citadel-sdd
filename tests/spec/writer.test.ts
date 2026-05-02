import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "../../src/spec/parse.js";
import { spliceFrontmatter } from "../../src/spec/writer.js";

const MINIMAL_FM = parseFrontmatter("| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | TestAgent |");

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
    const raw = "# Tasks\n\n| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | TestAgent |\n\n## P0\n";
    const out = spliceFrontmatter(raw, MINIMAL_FM, "inline");
    expect(out).toContain("Status: DRAFT 011900ZMAY26");
    expect(out).not.toContain("| Status |");
    expect(out.indexOf("# Tasks")).toBeLessThan(out.indexOf("Status:"));
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
