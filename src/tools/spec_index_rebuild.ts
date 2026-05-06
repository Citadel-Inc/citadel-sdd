import { mkdirSync } from "node:fs";
import { assertWorkingTreeClean, gitAdd, gitCommit } from "../spec/git.js";
import { buildIndex, renderIndex } from "../spec/index_render.js";
import type { RepoContext } from "../spec/repo.js";
import { specsRoot } from "../spec/repo.js";
import { ensureSpecBucketDirs } from "../spec/scaffold.js";
import { writeSpecReadmeFull } from "../spec/spec_readme.js";
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
  const scaffold_repairs = ensureSpecBucketDirs(repo);
  if (input.commit !== false) {
    assertWorkingTreeClean({ rootDir: ctx.rootDir }, [
      `${repo.specDir}/README.md`,
      ...scaffold_repairs,
    ]);
  }
  writeSpecReadmeFull(repo);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(index): rebuild specs/README.md (${active.length} active, ${done.length} done, ${parked.length} parked)`
        : `Rebuild specs/README.md`;
    const staged = [`${repo.specDir}/README.md`, ...scaffold_repairs];
    gitAdd({ rootDir: ctx.rootDir }, staged);
    try {
      commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
    } catch {
      commit_sha = null;
    }
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
