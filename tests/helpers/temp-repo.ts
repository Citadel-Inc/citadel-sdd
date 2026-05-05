import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "spec-fixtures");

export interface TempRepo {
  rootDir: string;
  cleanup(): void;
}

function git(rootDir: string, args: readonly string[]): void {
  execFileSync("git", ["-C", rootDir, ...args], { stdio: "ignore" });
}

export function makeTempRepo(
  opts: { activeFixtures?: string[]; doneFixtures?: string[]; parkedFixtures?: string[] } = {},
): TempRepo {
  const rootDir = mkdtempSync(join(tmpdir(), "citadel-sdd-test-"));
  execFileSync("git", ["-C", rootDir, "init", "--initial-branch=main"], { stdio: "ignore" });
  git(rootDir, ["config", "user.name", "Test Agent"]);
  git(rootDir, ["config", "user.email", "test@example.com"]);
  git(rootDir, ["config", "commit.gpgsign", "false"]);

  mkdirSync(join(rootDir, "specs", "active"), { recursive: true });
  mkdirSync(join(rootDir, "specs", "done"), { recursive: true });
  mkdirSync(join(rootDir, "specs", "parked"), { recursive: true });

  for (const slug of opts.activeFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(rootDir, "specs", "active", slug), { recursive: true });
  }
  for (const slug of opts.doneFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(rootDir, "specs", "done", slug), { recursive: true });
  }
  for (const slug of opts.parkedFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(rootDir, "specs", "parked", slug), { recursive: true });
  }

  writeFileSync(join(rootDir, "specs", "config.yaml"), "extends: default\n");
  writeFileSync(join(rootDir, "specs", "README.md"), "# Specs\n");
  git(rootDir, ["add", "."]);
  git(rootDir, ["commit", "-m", "initial fixture state"]);

  return {
    rootDir,
    cleanup() {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}
