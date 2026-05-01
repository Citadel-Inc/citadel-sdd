import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitAdd, gitCommit } from "../spec/git.js";
import { buildIndex, renderIndex } from "../spec/index_render.js";
import type { RepoContext } from "../spec/repo.js";
import type { ToolContext } from "./types.js";

export type SpecIndexRebuildInput = {
  commit?: boolean;
  dryRun?: boolean;
};

export interface SpecIndexRebuildOutput {
  active_count: number;
  done_count: number;
  commit_sha: string | null;
  dryRun: boolean;
  rendered: string;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specIndexRebuild(
  input: SpecIndexRebuildInput,
  ctx: ToolContext,
): SpecIndexRebuildOutput {
  const repo = repoCtx(ctx);
  const { active, done } = buildIndex(repo);
  const rendered = renderIndex(repo);
  const path = join(repo.rootDir, repo.specDir, "README.md");

  if (input.dryRun === true) {
    return {
      active_count: active.length,
      done_count: done.length,
      commit_sha: null,
      dryRun: true,
      rendered,
    };
  }

  writeFileSync(path, rendered);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(index): rebuild specs/README.md (${active.length} active, ${done.length} done)`
        : `Rebuild specs/README.md`;
    gitAdd({ rootDir: ctx.rootDir }, [`${repo.specDir}/README.md`]);
    try {
      commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
    } catch {
      commit_sha = null;
    }
  }

  return {
    active_count: active.length,
    done_count: done.length,
    commit_sha,
    dryRun: false,
    rendered,
  };
}
