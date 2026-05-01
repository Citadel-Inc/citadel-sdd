import { describe, expect, test } from "bun:test";
import { scanPriorityInNontasks, scanStrictFile } from "../../src/lint/strict.js";

describe("scanStrictFile", () => {
  test("flags asterisk bullet", () => {
    const f = scanStrictFile("tasks.md", "* [ ] item\n* [x] done\n");
    expect(f.map((x) => x.category)).toEqual(["strict-bullets", "strict-bullets"]);
  });

  test("flags numbered checklist", () => {
    const f = scanStrictFile("tasks.md", "1. [ ] one\n2. [x] two\n");
    expect(f.map((x) => x.category)).toEqual([
      "strict-numbered-checklist",
      "strict-numbered-checklist",
    ]);
  });

  test("flags alt checkbox states", () => {
    const f = scanStrictFile("tasks.md", "- [/] half\n- [~] strike\n- [?] q\n");
    expect(f).toHaveLength(3);
    expect(f.every((x) => x.category === "strict-alt-state")).toBe(true);
  });

  test("flags alt blocker marker", () => {
    const f = scanStrictFile("tasks.md", "- [ ] [BLOCKED] x\n- [ ] [TODO] y\n");
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.category === "strict-alt-marker")).toBe(true);
  });

  test("flags YAML frontmatter only at line 1", () => {
    const f1 = scanStrictFile("spec.md", "---\ntitle: x\n---\n");
    expect(f1.some((x) => x.category === "strict-frontmatter")).toBe(true);
    const f2 = scanStrictFile("spec.md", "# title\n\n---\n# divider above is OK\n");
    expect(f2.some((x) => x.category === "strict-frontmatter")).toBe(false);
  });

  test("flags TOML frontmatter at line 1", () => {
    const f = scanStrictFile("spec.md", "+++\nfoo=1\n+++\n");
    expect(f.some((x) => x.category === "strict-frontmatter")).toBe(true);
  });

  test("flags '## Priority N' heading", () => {
    const f = scanStrictFile("tasks.md", "## Priority 0\n## Priority: 1\n");
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.category === "strict-priority-heading")).toBe(true);
  });

  test("flags '## Phase N' heading", () => {
    const f = scanStrictFile("tasks.md", "## Phase 1\n### Phase 2\n");
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.category === "strict-priority-heading")).toBe(true);
  });

  test("clean canonical content yields no findings", () => {
    const md = `# T

| | |
|---|---|
| Status | DRAFT 011900ZMAY26 |

## P0

- [ ] [HUMAN] gate
- [x] done
`;
    const f = scanStrictFile("tasks.md", md);
    expect(f).toEqual([]);
  });
});

describe("scanPriorityInNontasks", () => {
  test("flags ## P0 in spec.md", () => {
    const f = scanPriorityInNontasks("spec.md", "## P0\n\n## P1\n");
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.category === "strict-priority-in-nontasks")).toBe(true);
  });

  test("doesn't flag P0 in body text without heading", () => {
    const f = scanPriorityInNontasks("spec.md", "P0 is the priority for X\n");
    expect(f).toEqual([]);
  });
});
