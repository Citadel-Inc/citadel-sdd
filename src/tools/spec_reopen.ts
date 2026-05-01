import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowDTG } from "../spec/dtg.js";
import { gitAdd, gitCommit, gitMv } from "../spec/git.js";
import { renderIndex } from "../spec/index_render.js";
import { setStatusOnSpec, setStatusOnTasks } from "../spec/mutate.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { canTransition } from "../spec/transitions.js";
import type { SpecState } from "../spec/types.js";
import { spliceFrontmatter } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecReopenInput {
  slug: string;
  reason: string;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecReopenOutput {
  slug: string;
  before: { state: SpecState; dtg: string; path: string };
  after: { state: SpecState; dtg: string; path: string };
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specReopen(input: SpecReopenInput, ctx: ToolContext): SpecReopenOutput {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new Error("reason_missing: spec_reopen requires a non-empty reason");
  }
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const specRaw = readFileSync(loc.specMd, "utf8");
  const tasksRaw = readFileSync(loc.tasksMd, "utf8");
  const spec = parseSpec(specRaw);
  const tasks = parseTasks(tasksRaw);

  const transition = canTransition(spec.frontmatter.status.state, "spec_reopen");
  if (!transition.ok) throw new Error(transition.error);

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const newStatus = {
    state: transition.to,
    dtg,
    tail: `reopened — ${input.reason}`,
  };

  const updatedSpec = setStatusOnSpec(spec, newStatus);
  const updatedTasks = setStatusOnTasks(tasks, newStatus);

  const newSpecRaw = spliceFrontmatter(specRaw, updatedSpec.frontmatter);
  const newTasksRaw = spliceFrontmatter(tasksRaw, updatedTasks.frontmatter);

  const beforePath = loc.relDir;
  const afterRelDir = `${repo.specDir}/active/${loc.slug}`;

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      before: {
        state: spec.frontmatter.status.state,
        dtg: spec.frontmatter.status.dtg,
        path: beforePath,
      },
      after: { state: newStatus.state, dtg: newStatus.dtg, path: afterRelDir },
      commit_sha: null,
      dryRun: true,
    };
  }

  writeFileSync(loc.specMd, newSpecRaw);
  writeFileSync(loc.tasksMd, newTasksRaw);

  if (loc.state === "done") {
    gitMv({ rootDir: ctx.rootDir }, beforePath, afterRelDir);
  }

  const indexPath = join(repo.rootDir, repo.specDir, "README.md");
  writeFileSync(indexPath, renderIndex(repo));

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): REOPEN — ${input.reason}`
        : `Reopen ${loc.slug}: ${input.reason}`;
    gitAdd({ rootDir: ctx.rootDir }, [
      `${afterRelDir}/spec.md`,
      `${afterRelDir}/tasks.md`,
      `${repo.specDir}/README.md`,
    ]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return {
    slug: loc.slug,
    before: {
      state: spec.frontmatter.status.state,
      dtg: spec.frontmatter.status.dtg,
      path: beforePath,
    },
    after: { state: newStatus.state, dtg: newStatus.dtg, path: afterRelDir },
    commit_sha,
    dryRun: false,
  };
}
