import { readFileSync, writeFileSync } from "node:fs";
import { gitAdd, gitCommit } from "../spec/git.js";
import { resolveTaskMatch, setTaskChecked } from "../spec/mutate.js";
import { parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { Priority } from "../spec/types.js";
import { spliceTasksFile } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface TaskCheckItem {
  phase: Priority;
  match: string | number;
  checked: boolean;
}

export interface SpecTaskCheckInput {
  slug: string;
  /** Batch form — check/uncheck multiple items in one call. */
  items?: TaskCheckItem[];
  /** Flat single-item form (backward compat). */
  phase?: Priority;
  match?: string | number;
  checked?: boolean;
  commit?: boolean;
  dryRun?: boolean;
}

export interface TaskCheckResult {
  phase: Priority;
  matched_index: number;
  matched_text: string;
  before: { checked: boolean };
  after: { checked: boolean };
}

export interface SpecTaskCheckOutput {
  slug: string;
  results: TaskCheckResult[];
  /** Backward-compat alias — mirrors results[0]. */
  matched_text: string;
  matched_index: number;
  before: { checked: boolean };
  after: { checked: boolean };
  commit_sha: string | null;
  dryRun: boolean;
}

function normalizeItems(input: SpecTaskCheckInput): TaskCheckItem[] {
  if (input.items && input.items.length > 0) return input.items;
  if (input.phase !== undefined && input.match !== undefined && input.checked !== undefined) {
    return [{ phase: input.phase, match: input.match, checked: input.checked }];
  }
  throw new Error("spec_task_check: provide either items[] or flat phase+match+checked");
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specTaskCheck(input: SpecTaskCheckInput, ctx: ToolContext): SpecTaskCheckOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.tasksMd, "utf8");
  let tasks = parseTasks(raw);

  const items = normalizeItems(input);
  const results: TaskCheckResult[] = [];

  for (const item of items) {
    const resolved = resolveTaskMatch(tasks, { phase: item.phase, match: item.match });
    if (!resolved) {
      const available = tasks.phases[item.phase].map((i) => `"${i.text.slice(0, 50)}"`).join(", ");
      throw new Error(
        `task_not_found: phase=${item.phase} match=${JSON.stringify(String(item.match))}` +
          (available ? `; available: [${available}]` : ""),
      );
    }
    const beforeChecked = tasks.phases[item.phase][resolved.idx]?.checked ?? false;
    tasks = setTaskChecked(tasks, { phase: item.phase, match: item.match }, item.checked);
    results.push({
      phase: item.phase,
      matched_index: resolved.idx + 1,
      matched_text: resolved.text,
      before: { checked: beforeChecked },
      after: { checked: item.checked },
    });
  }

  const first = results[0] ?? {
    phase: "P0" as Priority,
    matched_index: 0,
    matched_text: "",
    before: { checked: false },
    after: { checked: false },
  };

  const newRaw = spliceTasksFile(raw, tasks, ctx.profile.frontmatter_format);

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      results,
      matched_text: first.matched_text,
      matched_index: first.matched_index,
      before: first.before,
      after: first.after,
      commit_sha: null,
      dryRun: true,
    };
  }

  writeFileSync(loc.tasksMd, newRaw);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const count = results.length;
    const verb = results.every((r) => r.after.checked) ? "check" : "update";
    const phases = [...new Set(results.map((r) => r.phase))].join("+");
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): ${verb} ${count} ${phases} task${count !== 1 ? "s" : ""}`
        : `${verb} ${count} ${phases} task${count !== 1 ? "s" : ""} in ${loc.slug}`;
    gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/tasks.md`]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return {
    slug: loc.slug,
    results,
    matched_text: first.matched_text,
    matched_index: first.matched_index,
    before: first.before,
    after: first.after,
    commit_sha,
    dryRun: false,
  };
}
