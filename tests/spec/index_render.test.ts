import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildIndex } from "../../src/spec/index_render.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function writeMinimalSpec(dir: string, title: string, statusLine: string): void {
  writeFileSync(
    join(dir, "spec.md"),
    `# ${title}

| | |
|---|---|
| Status | ${statusLine} |
| Owner | TestAgent |
| Approved | TBD |

## Summary

Fixture.

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
`,
  );
  writeFileSync(
    join(dir, "tasks.md"),
    `# ${title}

| | |
|---|---|
| Status | ${statusLine} |

## P0

- [ ] Gate

## P1

- [ ] y

## P2

- [ ] z
`,
  );
  writeFileSync(join(dir, "plan.md"), `# ${title} — Plan\n`);
}

describe("buildIndex ordering", () => {
  test("Active rows: newest status DTG first (chronological, not lexicographic)", () => {
    temp = makeTempRepo();
    const specs = [
      ["may-end", "DRAFT 311200ZMAY26"],
      ["jun-start", "DRAFT 011200ZJUN26"],
    ] as const;
    for (const [slug, status] of specs) {
      const dir = join(temp.rootDir, "specs", "active", slug);
      mkdirSync(dir, { recursive: true });
      writeMinimalSpec(dir, slug, status);
    }
    const { active } = buildIndex({ rootDir: temp.rootDir, specDir: "specs" });
    expect(active.map((r) => r.slug)).toEqual(["jun-start", "may-end"]);
  });

  test("tie-break equal DTG by slug", () => {
    temp = makeTempRepo();
    const line = "DRAFT 011200ZJUN26";
    for (const slug of ["zebra", "alpha"] as const) {
      const dir = join(temp.rootDir, "specs", "active", slug);
      mkdirSync(dir, { recursive: true });
      writeMinimalSpec(dir, slug, line);
    }
    const { active } = buildIndex({ rootDir: temp.rootDir, specDir: "specs" });
    expect(active.map((r) => r.slug)).toEqual(["alpha", "zebra"]);
  });
});

describe("buildRow — corrupt spec visibility", () => {
  test("corrupt spec (no Status field) appears as ERROR row, not dropped", () => {
    temp = makeTempRepo();
    const dir = join(temp.rootDir, "specs", "active", "corrupt");
    mkdirSync(dir, { recursive: true });
    // Write a spec.md with no Status field — parseFrontmatter will throw
    writeFileSync(join(dir, "spec.md"), "# Corrupt\n\n| | |\n|---|---|\n| Owner | TestAgent |\n");
    writeFileSync(join(dir, "tasks.md"), "# Corrupt\n\n| | |\n|---|---|\n| Owner | x |\n");
    writeFileSync(join(dir, "plan.md"), "# Corrupt — Plan\n");

    const { active } = buildIndex({ rootDir: temp.rootDir, specDir: "specs" });
    expect(active).toHaveLength(1);
    expect(active[0]?.slug).toBe("corrupt");
    expect(active[0]?.state).toBe("ERROR");
    expect(active[0]?.note).toContain("frontmatter_status_missing");
  });

  test("unreadable spec.md (missing file) appears as ERROR row", () => {
    temp = makeTempRepo();
    const dir = join(temp.rootDir, "specs", "active", "missing-spec");
    mkdirSync(dir, { recursive: true });
    // Do NOT write spec.md — readFileSync will throw ENOENT
    writeFileSync(join(dir, "tasks.md"), "# T\n");
    writeFileSync(join(dir, "plan.md"), "# P\n");

    const { active } = buildIndex({ rootDir: temp.rootDir, specDir: "specs" });
    expect(active).toHaveLength(1);
    expect(active[0]?.state).toBe("ERROR");
  });
});
