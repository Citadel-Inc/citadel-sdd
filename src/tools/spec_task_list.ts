import { readFileSync } from "node:fs";
import { parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { Priority } from "../spec/types.js";
import { PRIORITIES } from "../spec/types.js";
import type { ToolContext } from "./types.js";

export interface SpecTaskListInput {
  slug: string;
  phases?: Priority[];
}

export interface TaskListItem {
  phase: Priority;
  index: number;
  text: string;
  checked: boolean;
  isHumanGate: boolean;
}

export interface SpecTaskListOutput {
  slug: string;
  items: TaskListItem[];
  total: number;
  unchecked: number;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specTaskList(input: SpecTaskListInput, ctx: ToolContext): SpecTaskListOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.tasksMd, "utf8");
  const tasks = parseTasks(raw);

  const phases = input.phases ?? PRIORITIES;
  const items: TaskListItem[] = [];

  for (const phase of phases) {
    tasks.phases[phase].forEach((item, i) => {
      items.push({
        phase,
        index: i + 1,
        text: item.text,
        checked: item.checked,
        isHumanGate: item.isHumanGate,
      });
    });
  }

  return {
    slug: loc.slug,
    items,
    total: items.length,
    unchecked: items.filter((i) => !i.checked).length,
  };
}
