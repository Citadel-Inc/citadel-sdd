import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specLint } from "../../src/tools/spec_lint.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let repo: TempRepo;

beforeEach(() => {
  repo = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
});

afterEach(() => {
  repo.cleanup();
});

function ctx(): ToolContext {
  return { rootDir: repo.rootDir, profile: resolveBuiltIn("default") };
}

function backdateCommit(rootDir: string, daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  const iso = d.toISOString();
  writeFileSync(join(rootDir, "specs", "active", "in-progress-midway", "tasks.md"), "touched\n", {
    flag: "a",
  });
  execFileSync("git", ["-C", rootDir, "add", "specs/active/in-progress-midway/tasks.md"], {
    stdio: "ignore",
  });
  execFileSync(
    "git",
    [
      "-C",
      rootDir,
      "-c",
      `user.name=Test`,
      "-c",
      `user.email=t@e`,
      "commit",
      "-m",
      "backdated touch",
      `--date=${iso}`,
    ],
    {
      env: { ...process.env, GIT_COMMITTER_DATE: iso, GIT_AUTHOR_DATE: iso },
      stdio: "ignore",
    },
  );
}

describe("stale-days lint", () => {
  test("emits stale finding when last commit older than threshold", () => {
    backdateCommit(repo.rootDir, 14);
    const out = specLint({ stale_days: 7 }, ctx());
    const stale = out.findings.filter((f) => f.code === "stale");
    expect(stale.length).toBeGreaterThanOrEqual(1);
    expect(stale[0]?.slug).toBe("in-progress-midway");
    expect(stale[0]?.message).toContain("14d ago");
  });

  test("does not emit when within threshold", () => {
    const out = specLint({ stale_days: 30 }, ctx());
    const stale = out.findings.filter((f) => f.code === "stale");
    expect(stale.length).toBe(0);
  });

  test("threshold=0 always emits stale", () => {
    const out = specLint({ stale_days: 0 }, ctx());
    const stale = out.findings.filter((f) => f.code === "stale");
    expect(stale.length).toBeGreaterThanOrEqual(1);
  });
});
