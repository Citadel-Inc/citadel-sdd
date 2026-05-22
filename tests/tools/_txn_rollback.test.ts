/**
 * Atomicity / rollback test for runSpecTxn (fix 1).
 *
 * Injects a gitCommit failure via a pre-commit hook and verifies that:
 * - git status --porcelain is empty after the failed mutation, and
 * - the spec files are byte-identical to their pre-mutation content.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specPark } from "../../src/tools/spec_park.js";
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

describe("runSpecTxn rollback on commit failure", () => {
  test("git status is clean and files are byte-identical after injected commit failure", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });

    // Record pre-mutation content.
    const specMdPath = join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md");
    const tasksMdPath = join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md");
    const preSpec = readFileSync(specMdPath, "utf8");
    const preTasks = readFileSync(tasksMdPath, "utf8");

    // Install a pre-commit hook that always rejects.
    const hookPath = join(temp.rootDir, ".git", "hooks", "pre-commit");
    writeFileSync(hookPath, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    // The mutation should throw (the hook rejects the commit).
    expect(() =>
      specPark({ slug: "draft-minimal", resolution: "blocked by hook" }, ctx()),
    ).toThrow();

    // After the throw, the working tree must be clean.
    const status = execFileSync("git", ["-C", temp.rootDir, "status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
    expect(status).toBe("");

    // The parked directory must not exist (rollback removed it).
    const parkedDir = join(temp.rootDir, "specs", "parked", "draft-minimal");
    expect(existsSync(parkedDir)).toBe(false);

    // The original active directory must still exist with original content.
    const activeDir = join(temp.rootDir, "specs", "active", "draft-minimal");
    expect(existsSync(activeDir)).toBe(true);
    expect(readFileSync(specMdPath, "utf8")).toBe(preSpec);
    expect(readFileSync(tasksMdPath, "utf8")).toBe(preTasks);
  });
});
