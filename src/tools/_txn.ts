/**
 * Atomic spec-mutation transaction helper.
 *
 * Wraps the write → gitMv → gitAdd → gitCommit sequence and rolls back on any
 * failure: `git checkout -f HEAD -- <scopePaths>` then `git clean -fd -- <scopePaths>`.
 *
 * PRECONDITION (enforced): the scoped paths must be HEAD-clean before entry.
 * A dirty scoped path is rejected with a `working_tree_dirty` error because
 * a partial rollback cannot be safely applied.
 */
import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";

export interface TxnOptions {
  /**
   * Repo-relative paths that define the rollback scope.
   * Must all be clean at HEAD before the transaction starts.
   */
  scopePaths: string[];
  /**
   * Absolute paths of .md files that will be written inside fn().
   * Checked for symlinks before fn() runs.
   */
  writeTargets: string[];
}

function git(rootDir: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", rootDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Assert that all scopePaths are clean at HEAD (no staged or unstaged changes).
 * Uses `git status --porcelain -- <paths>` which is pathspec-filtered by git itself.
 */
function assertScopeClean(rootDir: string, scopePaths: string[]): void {
  if (scopePaths.length === 0) return;
  const out = git(rootDir, ["status", "--porcelain", "--", ...scopePaths]);
  const dirty = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (dirty.length > 0) {
    throw new Error(`working_tree_dirty: ${dirty.join(", ")}`);
  }
}

/**
 * Assert that none of the write-target paths are symlinks.
 * Accepts paths that don't exist yet (new files created by fn) — skip lstat for those.
 */
function assertNoSymlinks(writeTargets: string[]): void {
  for (const p of writeTargets) {
    try {
      const stat = lstatSync(p);
      if (stat.isSymbolicLink()) {
        throw new Error(`target_is_symlink: ${p}`);
      }
    } catch (e: unknown) {
      // ENOENT: file doesn't exist yet — fine, it's new
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
  }
}

/**
 * Roll back changes to scopePaths by restoring them from HEAD.
 *
 * Each git operation is attempted per-path so that a single path not in HEAD
 * (e.g. afterRelDir from a gitMv) cannot abort restoration of sibling paths.
 */
function rollback(rootDir: string, scopePaths: string[]): void {
  if (scopePaths.length === 0) return;

  // 1. Unstage everything under the scope in one call (reset tolerates unknown paths).
  try {
    git(rootDir, ["reset", "HEAD", "--", ...scopePaths]);
  } catch {
    /* ignore rollback failures */
  }

  // 2. Restore each scope path individually from HEAD.
  //    A path that was never in HEAD (e.g. the afterRelDir) will fail — swallow and continue.
  for (const p of scopePaths) {
    try {
      git(rootDir, ["checkout", "-f", "HEAD", "--", p]);
    } catch {
      /* path may not exist in HEAD — e.g. afterRelDir after a gitMv */
    }
  }

  // 3. Remove any untracked files/dirs under the scope (e.g. new dir from gitMv).
  for (const p of scopePaths) {
    try {
      git(rootDir, ["clean", "-fd", "--", p]);
    } catch {
      /* ignore rollback failures */
    }
  }
}

/**
 * Run a spec mutation inside an atomic transaction.
 *
 * @param rootDir   Absolute path to the git repository root.
 * @param opts      Scope and write-target paths.
 * @param fn        The mutation function (write + git ops). Must be synchronous.
 * @returns         Whatever `fn` returns.
 * @throws          Original error from `fn` (after rolling back), or pre-condition errors.
 */
export function runSpecTxn<T>(rootDir: string, opts: TxnOptions, fn: () => T): T {
  assertScopeClean(rootDir, opts.scopePaths);
  assertNoSymlinks(opts.writeTargets);
  try {
    return fn();
  } catch (err) {
    rollback(rootDir, opts.scopePaths);
    throw err;
  }
}
