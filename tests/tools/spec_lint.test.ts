import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specLint } from "../../src/tools/spec_lint.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(profileName: "default" | "bastion" | "citadel" = "default"): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn(profileName) };
}

describe("specLint", () => {
  test("clean fixture suite has zero error findings", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal", "approved-ratified"],
      doneFixtures: ["done"],
    });
    const out = specLint({ include_done: true }, ctx());
    const errors = out.findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
    expect(out.exit_code).toBe(0);
  });

  test("flags status_drift when spec.md and tasks.md disagree", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const tasksPath = join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md");
    writeFileSync(
      tasksPath,
      "# Drifted\n\n| | |\n|---|---|\n| Status | IN_PROGRESS 011900ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );
    const out = specLint({ slug: "draft-minimal" }, ctx());
    expect(out.findings.some((f) => f.code === "status_drift")).toBe(true);
    expect(out.findings.find((f) => f.code === "status_drift")?.severity).toBe("warning");
  });

  test("warns on unratified Q-table for non-DRAFT spec", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const specPath = join(temp.rootDir, "specs", "active", "approved-ratified", "spec.md");
    writeFileSync(
      specPath,
      `# Drifted

| | |
|---|---|
| Status | APPROVED 011910ZMAY26 |
| Owner | TestAgent |

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | Q? | A | TBD |
`,
    );
    const out = specLint({ slug: "approved-ratified" }, ctx());
    expect(out.findings.some((f) => f.code === "qtable_unratified")).toBe(true);
  });

  test("scope=active by default skips done/", () => {
    temp = makeTempRepo({
      activeFixtures: ["draft-minimal"],
      doneFixtures: ["done"],
    });
    const out = specLint({}, ctx());
    expect(out.findings.every((f) => f.slug !== "done")).toBe(true);
  });

  test("include_parked covers parked/", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    const out = specLint({ include_parked: true }, ctx());
    const errors = out.findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
    expect(out.exit_code).toBe(0);
  });

  test("unknown slug yields spec_not_found error", () => {
    temp = makeTempRepo();
    const out = specLint({ slug: "missing" }, ctx());
    expect(out.findings.some((f) => f.code === "spec_not_found")).toBe(true);
    expect(out.exit_code).toBe(1);
  });

  test("status_tail_missing info-level under conventional commit profile", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const specPath = join(temp.rootDir, "specs", "active", "in-progress-midway", "spec.md");
    writeFileSync(
      specPath,
      `# X

| | |
|---|---|
| Status | IN_PROGRESS 011920ZMAY26 |
| Owner | TestAgent |
`,
    );
    const tasksPath = join(temp.rootDir, "specs", "active", "in-progress-midway", "tasks.md");
    writeFileSync(
      tasksPath,
      "# T\n\n| | |\n|---|---|\n| Status | IN_PROGRESS 011920ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );
    const out = specLint({ slug: "in-progress-midway" }, ctx("bastion"));
    expect(out.findings.some((f) => f.code === "status_tail_missing")).toBe(true);
    expect(out.findings.find((f) => f.code === "status_tail_missing")?.severity).toBe("info");
  });
});
