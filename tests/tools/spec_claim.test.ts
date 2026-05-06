import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specClaim } from "../../src/tools/spec_claim.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

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

describe("specClaim", () => {
  test("APPROVED -> IN_PROGRESS, status updated, commit created", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const out = specClaim({ slug: "approved-ratified", claimer: "Bastion" }, ctx());
    expect(out.before.state).toBe("APPROVED");
    expect(out.after.state).toBe("IN_PROGRESS");
    expect(out.after.dtg).toBe("011945ZMAY26");
    expect(out.commit_sha).not.toBeNull();
    const md = readFileSync(
      join(temp.rootDir, "specs", "active", "approved-ratified", "spec.md"),
      "utf8",
    );
    expect(md).toContain("IN_PROGRESS 011945ZMAY26 — Bastion claims execution");
  });

  test("DRAFT -> IN_PROGRESS only when claimer is owner; bulk-ratifies Q-table by default", () => {
    temp = makeTempRepo();
    const fs = require("node:fs") as typeof import("node:fs");
    const dir = join(temp.rootDir, "specs", "active", "draft-mine");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      join(dir, "spec.md"),
      `# Mine

| | |
|---|---|
| Status | DRAFT 011900ZMAY26 |
| Owner | TestAgent |

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | Yes? | Yes | TBD |
`,
    );
    fs.writeFileSync(join(dir, "plan.md"), "");
    fs.writeFileSync(
      join(dir, "tasks.md"),
      "| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fixture`);

    const out = specClaim({ slug: "draft-mine", claimer: "TestAgent" }, ctx());
    expect(out.after.state).toBe("IN_PROGRESS");
    expect(out.ratified_q_count).toBe(1);
    const md = readFileSync(join(dir, "spec.md"), "utf8");
    expect(md).toContain("Ratified 011945ZMAY26");
  });

  test("DRAFT claim by non-owner rejected", () => {
    temp = makeTempRepo();
    const fs = require("node:fs") as typeof import("node:fs");
    const dir = join(temp.rootDir, "specs", "active", "draft-other");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      join(dir, "spec.md"),
      "# X\n\n| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n| Owner | OwnerA |\n",
    );
    fs.writeFileSync(join(dir, "plan.md"), "");
    fs.writeFileSync(
      join(dir, "tasks.md"),
      "| | |\n|---|---|\n| Status | DRAFT 011900ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );

    expect(() => specClaim({ slug: "draft-other", claimer: "OwnerB" }, ctx())).toThrow(
      "state_invalid",
    );
  });

  test("ratify:false rejects when TBD rows present", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const fs = require("node:fs") as typeof import("node:fs");
    const path = join(temp.rootDir, "specs", "active", "approved-ratified", "spec.md");
    fs.writeFileSync(
      path,
      `# X

| | |
|---|---|
| Status | APPROVED 011910ZMAY26 |
| Owner | TestAgent |

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | a | b | TBD |
`,
    );
    expect(() =>
      specClaim({ slug: "approved-ratified", claimer: "Bastion", ratify: false }, ctx()),
    ).toThrow("ratify_required");
  });

  test("dryRun no write", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const path = join(temp.rootDir, "specs", "active", "approved-ratified", "spec.md");
    const before = readFileSync(path, "utf8");
    specClaim({ slug: "approved-ratified", claimer: "Bastion", dryRun: true }, ctx());
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("rejects spec_claim from DONE", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    expect(() => specClaim({ slug: "done", claimer: "Bastion" }, ctx())).toThrow("state_invalid");
  });
});
