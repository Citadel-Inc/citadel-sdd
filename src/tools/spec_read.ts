import { readFileSync } from "node:fs";
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
  state: "active" | "done";
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
  return {
    slug: loc.slug,
    state: loc.state,
    spec_md: parts.has("spec") ? specMd : null,
    plan_md: parts.has("plan") ? readFileSync(loc.planMd, "utf8") : null,
    tasks_md: parts.has("tasks") ? readFileSync(loc.tasksMd, "utf8") : null,
    frontmatter: parseFrontmatter(specMd),
  };
}
