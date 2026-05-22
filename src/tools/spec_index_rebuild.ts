import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { gitAdd, gitCommit } from "../spec/git.js";
import { buildIndex, renderIndex } from "../spec/index_render.js";
import type { RepoContext } from "../spec/repo.js";
import { specsRoot } from "../spec/repo.js";
import { ensureSpecBucketDirs } from "../spec/scaffold.js";
import { writeSpecReadmeFull } from "../spec/spec_readme.js";
import { runSpecTxn } from "./_txn.js";
import type { ToolContext } from "./types.js";

export type SpecIndexRebuildInput = {
  commit?: boolean;
  dryRun?: boolean;
};

export interface SpecIndexRebuildOutput {
  active_count: number;
  done_count: number;
  parked_count: number;
  commit_sha: string | null;
  dryRun: boolean;
  rendered: string;
  /** Repo-relative paths created while ensuring active/done/parked buckets (empty if unchanged). */
  scaffold_repairs: string[];
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

/**
 * Returns true if any of `files` are staged (i.e. differ from HEAD in the index).
 * Used to guard gitCommit when writeSpecReadmeFull produces identical content.
 */
function hasStagedChanges(rootDir: string, files: readonly string[]): boolean {
  if (files.length === 0) return false;
  try {
    execFileSync("git", ["-C", rootDir, "diff", "--cached", "--quiet", "--", ...files], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return false; // exit 0 means no diff → nothing staged
  } catch {
    return true; // exit 1 means diff → something staged
  }
}

export function specIndexRebuild(
  input: SpecIndexRebuildInput,
  ctx: ToolContext,
): SpecIndexRebuildOutput {
  const repo = repoCtx(ctx);
  const { active, done, parked } = buildIndex(repo);
  const rendered = renderIndex(repo);

  if (input.dryRun === true) {
    return {
      active_count: active.length,
      done_count: done.length,
      parked_count: parked.length,
      commit_sha: null,
      dryRun: true,
      rendered,
      scaffold_repairs: [],
    };
  }

  mkdirSync(specsRoot(repo), { recursive: true });

  let commit_sha: string | null = null;
  let scaffold_repairs: string[] = [];

  if (input.commit !== false) {
    runSpecTxn(ctx.rootDir, { scopePaths: [`${repo.specDir}/README.md`], writeTargets: [] }, () => {
      scaffold_repairs = ensureSpecBucketDirs(repo);
      writeSpecReadmeFull(repo);
      const subject =
        ctx.profile.commit_style === "conventional"
          ? `spec(index): rebuild specs/README.md (${active.length} active, ${done.length} done, ${parked.length} parked)`
          : `Rebuild specs/README.md`;
      const toStage = [`${repo.specDir}/README.md`, ...scaffold_repairs];
      gitAdd({ rootDir: ctx.rootDir }, toStage);
      // Skip commit if README content is identical to HEAD (nothing to commit).
      if (hasStagedChanges(ctx.rootDir, toStage)) {
        commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
      }
    });
  } else {
    scaffold_repairs = ensureSpecBucketDirs(repo);
    writeSpecReadmeFull(repo);
  }

  return {
    active_count: active.length,
    done_count: done.length,
    parked_count: parked.length,
    commit_sha,
    dryRun: false,
    rendered,
    scaffold_repairs,
  };
}
