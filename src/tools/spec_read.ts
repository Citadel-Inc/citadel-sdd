import { existsSync, readFileSync } from "node:fs";
import { parseFrontmatter } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { Frontmatter } from "../spec/types.js";
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
  frontmatter: Frontmatter;
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

  let plan_md: string | null = null;
  if (parts.has("plan")) {
    if (!existsSync(loc.planMd)) {
      throw new Error(`file_not_found: plan.md missing for spec ${loc.slug} at ${loc.planMd}`);
    }
    plan_md = readFileSync(loc.planMd, "utf8");
  }

  let tasks_md: string | null = null;
  if (parts.has("tasks")) {
    if (!existsSync(loc.tasksMd)) {
      throw new Error(`file_not_found: tasks.md missing for spec ${loc.slug} at ${loc.tasksMd}`);
    }
    tasks_md = readFileSync(loc.tasksMd, "utf8");
  }

  return {
    slug: loc.slug,
    state: loc.state,
    spec_md: parts.has("spec") ? specMd : null,
    plan_md,
    tasks_md,
    frontmatter: parseFrontmatter(specMd),
  };
}
