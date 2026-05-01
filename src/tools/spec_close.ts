import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowDTG } from "../spec/dtg.js";
import { gitAdd, gitCommit, gitMv, gitPush } from "../spec/git.js";
import { renderIndex } from "../spec/index_render.js";
import { setStatusOnSpec, setStatusOnTasks, setTaskChecked } from "../spec/mutate.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { canTransition } from "../spec/transitions.js";
import type { Priority, SpecState } from "../spec/types.js";
import { PRIORITIES } from "../spec/types.js";
import { spliceFrontmatter, spliceTasksFile } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecCloseInput {
  slug: string;
  summary: string;
  allow_open?: Priority[];
  commit?: boolean;
  push?: boolean;
  dryRun?: boolean;
}

export interface SpecCloseOutput {
  slug: string;
  before: { state: SpecState; dtg: string; path: string };
  after: { state: SpecState; dtg: string; path: string };
  commit_sha: string | null;
  pushed: boolean;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specClose(input: SpecCloseInput, ctx: ToolContext): SpecCloseOutput {
  if (!input.summary || input.summary.trim().length === 0) {
    throw new Error("summary_missing: spec_close requires a non-empty summary");
  }
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const specRaw = readFileSync(loc.specMd, "utf8");
  const tasksRaw = readFileSync(loc.tasksMd, "utf8");
  const spec = parseSpec(specRaw);
  const tasksParsed = parseTasks(tasksRaw);

  const transition = canTransition(spec.frontmatter.status.state, "spec_close");
  if (!transition.ok) throw new Error(transition.error);

  const allowOpen = new Set<Priority>(input.allow_open ?? []);
  for (const p of PRIORITIES) {
    if (allowOpen.has(p)) continue;
    const open = tasksParsed.phases[p].filter((i) => !i.checked).length;
    if (open > 0) {
      throw new Error(`tasks_open: ${p} has ${open} unchecked item(s); use allow_open to bypass`);
    }
  }

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const newStatus = { state: transition.to, dtg, tail: input.summary };

  let updatedTasks = setStatusOnTasks(tasksParsed, newStatus);
  for (const p of PRIORITIES) {
    if (allowOpen.has(p)) continue;
    let i = 0;
    for (const item of updatedTasks.phases[p]) {
      if (!item.checked) {
        updatedTasks = setTaskChecked(updatedTasks, { phase: p, match: i + 1 }, true);
      }
      i++;
    }
  }

  const updatedSpec = setStatusOnSpec(spec, newStatus);

  const newSpecRaw = spliceFrontmatter(specRaw, updatedSpec.frontmatter);
  const newTasksRaw = spliceTasksFile(tasksRaw, updatedTasks);

  const beforePath = loc.relDir;
  const afterRelDir = `${repo.specDir}/done/${loc.slug}`;

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
      pushed: false,
      dryRun: true,
    };
  }

  writeFileSync(loc.specMd, newSpecRaw);
  writeFileSync(loc.tasksMd, newTasksRaw);

  if (loc.state === "active") {
    gitMv({ rootDir: ctx.rootDir }, beforePath, afterRelDir);
  }

  const indexPath = join(repo.rootDir, repo.specDir, "README.md");
  writeFileSync(indexPath, renderIndex(repo));

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): DONE — ${input.summary}`
        : `Close ${loc.slug}: ${input.summary}`;
    gitAdd({ rootDir: ctx.rootDir }, [
      `${afterRelDir}/spec.md`,
      `${afterRelDir}/tasks.md`,
      `${repo.specDir}/README.md`,
    ]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  let pushed = false;
  const wantPush =
    input.push ?? (ctx.profile.push_policy === "on_close" || ctx.profile.push_policy === "always");
  if (wantPush && commit_sha !== null) {
    try {
      gitPush({ rootDir: ctx.rootDir });
      pushed = true;
    } catch {
      pushed = false;
    }
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
    pushed,
    dryRun: false,
  };
}
