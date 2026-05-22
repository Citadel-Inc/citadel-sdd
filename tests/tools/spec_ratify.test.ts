import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specRatify } from "../../src/tools/spec_ratify.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

function gitCommitAll(rootDir: string, msg: string): void {
  execFileSync("git", ["-C", rootDir, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", rootDir, "commit", "-m", msg], { stdio: "ignore" });
}

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0));

function ctx(): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn("bastion"), clock: CLOCK };
}

describe("specRatify", () => {
  test("bulk ratify: TBD rows → Ratified <DTG>", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const specPath = join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md");

    writeFileSync(
      specPath,
      `# T

| | |
|---|---|
| Status | DRAFT 011900ZMAY26 |

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | A? | Yes | TBD |
| Q2 | B? | No | TBD |
`,
    );
    // Commit the modified spec.md so the working tree is clean before specRatify runs.
    gitCommitAll(temp.rootDir, "fixture: add TBD Q-table");
    const out = specRatify({ slug: "draft-minimal" }, ctx());
    expect(out.ratified_q_count).toBe(2);
    expect(out.commit_sha).not.toBeNull();
    const updated = readFileSync(specPath, "utf8");
    expect(updated).toContain("Ratified 011945ZMAY26");
    expect(updated).not.toContain("TBD");
  });

  test("per-decision overrides preserved", () => {
    temp = makeTempRepo();
    const dir = join(temp.rootDir, "specs", "active", "deciding");

    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "spec.md"),
      `# T

| | |
|---|---|
| Status | DRAFT 011900ZMAY26 |

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | x? | Yes | TBD |
| Q2 | y? | No | TBD |
`,
    );
    writeFileSync(join(dir, "plan.md"), "");
    writeFileSync(
      join(dir, "tasks.md"),
      "| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );
    const out = specRatify(
      {
        slug: "deciding",
        decisions: { Q2: { text: "Ratified-with-deviation 011945ZMAY26: changed to Yes" } },
        commit: false,
      },
      ctx(),
    );
    expect(out.ratified_q_count).toBe(2);
    const updated = readFileSync(join(dir, "spec.md"), "utf8");
    expect(updated).toContain("Ratified 011945ZMAY26 |");
    expect(updated).toContain("Ratified-with-deviation 011945ZMAY26: changed to Yes");
  });

  test("dryRun does not modify file", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const specPath = join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md");
    const before = readFileSync(specPath, "utf8");
    const out = specRatify({ slug: "draft-minimal", dryRun: true }, ctx());
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(readFileSync(specPath, "utf8")).toBe(before);
  });

  test("ratified_q_count=0 when nothing to ratify", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specRatify({ slug: "approved-ratified" }, ctx());
    expect(out.ratified_q_count).toBe(0);
  });

  test("unknown slug throws", () => {
    temp = makeTempRepo();
    expect(() => specRatify({ slug: "missing" }, ctx())).toThrow("spec_not_found");
  });
});
