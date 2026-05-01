import { readFileSync, writeFileSync } from "node:fs";
import { gitAdd, gitCommit } from "../spec/git.js";
import { setTaskChecked } from "../spec/mutate.js";
import { parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { Priority } from "../spec/types.js";
import { spliceTasksFile } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecTaskCheckInput {
  slug: string;
  phase: Priority;
  match: string | number;
  checked: boolean;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecTaskCheckOutput {
  slug: string;
  before: { checked: boolean };
  after: { checked: boolean };
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specTaskCheck(input: SpecTaskCheckInput, ctx: ToolContext): SpecTaskCheckOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.tasksMd, "utf8");
  const tasks = parseTasks(raw);

  const matchKey = { phase: input.phase, match: input.match };
  const updated = setTaskChecked(tasks, matchKey, input.checked);

  const beforeChecked = (() => {
    const items = tasks.phases[input.phase];
    if (typeof input.match === "number") {
      const item = items[input.match - 1];
      return item ? item.checked : false;
    }
    const found = items.find((i) => i.text.startsWith(String(input.match)));
    return found ? found.checked : false;
  })();

  const newRaw = spliceTasksFile(raw, updated);

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      before: { checked: beforeChecked },
      after: { checked: input.checked },
      commit_sha: null,
      dryRun: true,
    };
  }

  writeFileSync(loc.tasksMd, newRaw);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const verb = input.checked ? "check" : "uncheck";
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): ${verb} ${input.phase} task`
        : `${verb} ${input.phase} task in ${loc.slug}`;
    gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/tasks.md`]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return {
    slug: loc.slug,
    before: { checked: beforeChecked },
    after: { checked: input.checked },
    commit_sha,
    dryRun: false,
  };
}
