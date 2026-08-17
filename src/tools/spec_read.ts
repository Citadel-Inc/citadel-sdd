import { existsSync, readFileSync } from "node:fs";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { ToolContext } from "./types.js";

export type SpecReadPart = "spec" | "plan" | "tasks";

export interface SpecReadInput {
  slug: string;
  parts?: SpecReadPart[];
}

export interface SpecReadOutput {
  slug: string;
  state: "active" | "done" | "parked";
  spec_md: string | null;
  plan_md: string | null;
  tasks_md: string | null;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specRead(input: SpecReadInput, ctx: ToolContext): SpecReadOutput {
  const loc = locateSpec(repoCtx(ctx), input.slug);
  if (!loc) {
    throw new Error(`spec_not_found: ${input.slug}`);
  }
  const parts = new Set<SpecReadPart>(input.parts ?? ["spec", "plan", "tasks"]);
  const specMd = readFileSync(loc.specMd, "utf8");

  let planMd: string | null = null;
  if (parts.has("plan")) {
    if (!existsSync(loc.planMd)) {
      throw new Error(`file_not_found: plan.md missing for spec ${loc.slug} at ${loc.planMd}`);
    }
    planMd = readFileSync(loc.planMd, "utf8");
  }

  let tasksMd: string | null = null;
  if (parts.has("tasks")) {
    if (!existsSync(loc.tasksMd)) {
      throw new Error(`file_not_found: tasks.md missing for spec ${loc.slug} at ${loc.tasksMd}`);
    }
    tasksMd = readFileSync(loc.tasksMd, "utf8");
  }

  return {
    slug: loc.slug,
    state: loc.state,
    spec_md: parts.has("spec") ? specMd : null,
    plan_md: planMd,
    tasks_md: tasksMd,
  };
}
