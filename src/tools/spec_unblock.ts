import { readFileSync, writeFileSync } from "node:fs";
import { nowDTG } from "../spec/dtg.js";
import { gitAdd, gitCommit } from "../spec/git.js";
import { setStatusOnSpec, setStatusOnTasks } from "../spec/mutate.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { assertTransitionEnabled, canTransition } from "../spec/transitions.js";
import type { SpecState } from "../spec/types.js";
import { spliceFrontmatter } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecUnblockInput {
  slug: string;
  resolution: string;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecUnblockOutput {
  slug: string;
  before: { state: SpecState; dtg: string };
  after: { state: SpecState; dtg: string };
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function removeBlockingSection(rawMd: string): string {
  return rawMd.replace(/## Blocking\s*\n[\s\S]*?(?=\n## |$)\n*/g, "");
}

export function specUnblock(input: SpecUnblockInput, ctx: ToolContext): SpecUnblockOutput {
  if (!input.resolution || input.resolution.trim().length === 0) {
    throw new Error("resolution_missing: spec_unblock requires a non-empty resolution");
  }
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const specRaw = readFileSync(loc.specMd, "utf8");
  const tasksRaw = readFileSync(loc.tasksMd, "utf8");
  const spec = parseSpec(specRaw);
  const tasks = parseTasks(tasksRaw);

  assertTransitionEnabled("spec_unblock", ctx.profile.disabled_transitions);
  const transition = canTransition(spec.frontmatter.status.state, "spec_unblock");
  if (!transition.ok) throw new Error(transition.error);

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const newStatus = {
    state: transition.to,
    dtg,
    tail: `unblocked — ${input.resolution}`,
  };

  const updatedSpec = setStatusOnSpec(spec, newStatus);
  const updatedTasks = setStatusOnTasks(tasks, newStatus);

  const fmt = ctx.profile.frontmatter_format;
  let newSpecRaw = spliceFrontmatter(specRaw, updatedSpec.frontmatter, fmt);
  newSpecRaw = removeBlockingSection(newSpecRaw);
  const newTasksRaw = spliceFrontmatter(tasksRaw, updatedTasks.frontmatter, fmt);

  const before = { state: spec.frontmatter.status.state, dtg: spec.frontmatter.status.dtg };
  const after = { state: newStatus.state, dtg: newStatus.dtg };

  if (input.dryRun === true) {
    return { slug: loc.slug, before, after, commit_sha: null, dryRun: true };
  }

  writeFileSync(loc.specMd, newSpecRaw);
  writeFileSync(loc.tasksMd, newTasksRaw);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): UNBLOCK — ${input.resolution}`
        : `Unblock ${loc.slug}: ${input.resolution}`;
    gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/spec.md`, `${loc.relDir}/tasks.md`]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return { slug: loc.slug, before, after, commit_sha, dryRun: false };
}
