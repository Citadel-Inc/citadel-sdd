import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseSpec, parseTasks } from "./parse.js";
import type { ParsedSpec, ParsedTasks } from "./types.js";

export interface RepoContext {
  rootDir: string;
  specDir: string;
}

export type SpecLifecycleState = "active" | "done";

export interface SpecLocation {
  slug: string;
  state: SpecLifecycleState;
  dir: string;
  specMd: string;
  planMd: string;
  tasksMd: string;
  relDir: string;
}

export function specsRoot(ctx: RepoContext): string {
  return join(ctx.rootDir, ctx.specDir);
}

function buildLocation(ctx: RepoContext, state: SpecLifecycleState, slug: string): SpecLocation {
  const dir = join(specsRoot(ctx), state, slug);
  return {
    slug,
    state,
    dir,
    specMd: join(dir, "spec.md"),
    planMd: join(dir, "plan.md"),
    tasksMd: join(dir, "tasks.md"),
    relDir: relative(ctx.rootDir, dir),
  };
}

export function locateSpec(ctx: RepoContext, slug: string): SpecLocation | null {
  for (const state of ["active", "done"] as const) {
    const dir = join(specsRoot(ctx), state, slug);
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      return buildLocation(ctx, state, slug);
    }
  }
  return null;
}

export function listSpecs(
  ctx: RepoContext,
  scope: SpecLifecycleState | "all" = "all",
): SpecLocation[] {
  const out: SpecLocation[] = [];
  const states: SpecLifecycleState[] = scope === "all" ? ["active", "done"] : [scope];
  for (const state of states) {
    const dir = join(specsRoot(ctx), state);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      out.push(buildLocation(ctx, state, entry.name));
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function readSpec(loc: SpecLocation): ParsedSpec {
  return parseSpec(readFileSync(loc.specMd, "utf8"));
}

export function readTasks(loc: SpecLocation): ParsedTasks {
  return parseTasks(readFileSync(loc.tasksMd, "utf8"));
}

export function readPlan(loc: SpecLocation): string {
  return readFileSync(loc.planMd, "utf8");
}

export function slugLooksValid(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
