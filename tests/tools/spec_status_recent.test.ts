import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specStatus } from "../../src/tools/spec_status.js";
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

function touchAndCommit(rootDir: string, n: number) {
  const path = join(rootDir, "specs", "active", "in-progress-midway", "tasks.md");
  for (let i = 0; i < n; i++) {
    writeFileSync(path, `touch ${i}\n`, { flag: "a" });
    execFileSync("git", ["-C", rootDir, "add", "specs/active/in-progress-midway/tasks.md"], {
      stdio: "ignore",
    });
    execFileSync(
      "git",
      ["-C", rootDir, "-c", "user.name=T", "-c", "user.email=t@e", "commit", "-m", `touch ${i}`],
      { stdio: "ignore" },
    );
  }
}

describe("spec_status recent_commits", () => {
  test("recent_limit=N returns last N subjects", () => {
    touchAndCommit(repo.rootDir, 3);
    const out = specStatus({ slug: "in-progress-midway", recent_limit: 2 }, ctx());
    expect(out.recent_commits?.length).toBe(2);
    expect(out.recent_commits?.[0]).toContain("touch 2");
  });

  test("omits recent_commits when not requested", () => {
    const out = specStatus({ slug: "in-progress-midway" }, ctx());
    expect(out.recent_commits).toBeUndefined();
  });

  test("days_since populated from initial commit", () => {
    const out = specStatus({ slug: "in-progress-midway" }, ctx());
    expect(out.last_touched).toBeDefined();
    expect(out.days_since).toBeDefined();
  });

  test("reason populated for active spec", () => {
    const out = specStatus({ slug: "in-progress-midway" }, ctx());
    expect(out.reason).toBeDefined();
  });
});
