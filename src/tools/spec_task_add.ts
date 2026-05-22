import { readFileSync, writeFileSync } from "node:fs";
import { gitAdd, gitCommit } from "../spec/git.js";
import { addTaskItem } from "../spec/mutate.js";
import { parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { Priority } from "../spec/types.js";
import { spliceTasksFile } from "../spec/writer.js";
import { runSpecTxn } from "./_txn.js";
import type { ToolContext } from "./types.js";

export interface SpecTaskAddInput {
  slug: string;
  phase: Priority;
  text: string;
  blocker?: boolean;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecTaskAddOutput {
  slug: string;
  added_index: number;
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specTaskAdd(input: SpecTaskAddInput, ctx: ToolContext): SpecTaskAddOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.tasksMd, "utf8");
  const tasks = parseTasks(raw);
  const updated = addTaskItem(tasks, input.phase, input.text, input.blocker);
  const added_index = updated.phases[input.phase].length;
  const newRaw = spliceTasksFile(raw, updated, ctx.profile.frontmatter_format);

  if (input.dryRun === true) {
    return { slug: loc.slug, added_index, commit_sha: null, dryRun: true };
  }

  let commit_sha: string | null = null;

  if (input.commit !== false) {
    runSpecTxn(
      ctx.rootDir,
      { scopePaths: [`${loc.relDir}/tasks.md`], writeTargets: [loc.tasksMd] },
      () => {
        writeFileSync(loc.tasksMd, newRaw);
        const subject =
          ctx.profile.commit_style === "conventional"
            ? `spec(${loc.slug}): add ${input.phase} task`
            : `Add ${input.phase} task to ${loc.slug}`;
        gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/tasks.md`]);
        commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
      },
    );
  } else {
    writeFileSync(loc.tasksMd, newRaw);
  }

  return { slug: loc.slug, added_index, commit_sha, dryRun: false };
}
