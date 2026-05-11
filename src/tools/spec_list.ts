import { readFileSync } from "node:fs";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { listSpecs, type RepoContext } from "../spec/repo.js";
import type { SpecState } from "../spec/types.js";
import type { ToolContext } from "./types.js";

export interface SpecListInput {
  state?: "active" | "done" | "parked" | "blocked" | "all";
  mine?: boolean;
  slim?: boolean;
  limit?: number;
  offset?: number;
}

export interface SpecListEntry {
  slug: string;
  state: SpecState;
  dtg: string;
  owner: string;
  approved_dtg: string | null;
  ratified: boolean;
  p0_remaining: number;
  p1_remaining: number;
  p2_remaining: number;
  blockers: string[];
  tasks: { checked: number; total: number };
}

export interface SpecListSlimEntry {
  slug: string;
  state: SpecState;
  dtg: string;
  owner: string;
  p0: number;
  p1: number;
  p2: number;
  tasks: { checked: number; total: number };
}


function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specList(
  input: SpecListInput & { slim: true },
  ctx: ToolContext,
): SpecListSlimEntry[];
export function specList(
  input: SpecListInput & { slim?: false | undefined },
  ctx: ToolContext,
): SpecListEntry[];
export function specList(
  input: SpecListInput,
  ctx: ToolContext,
): SpecListEntry[] | SpecListSlimEntry[];
export function specList(
  input: SpecListInput,
  ctx: ToolContext,
): SpecListEntry[] | SpecListSlimEntry[] {
  const requested = input.state ?? "active";
  const dirScope: "active" | "done" | "parked" | "all" =
    requested === "blocked" || requested === "all" ? "all" : requested;
  const locations = listSpecs(repoCtx(ctx), dirScope);
  const entries: SpecListEntry[] = [];

  for (const loc of locations) {
    let specMd = "";
    let tasksMd = "";
    try {
      specMd = readFileSync(loc.specMd, "utf8");
      tasksMd = readFileSync(loc.tasksMd, "utf8");
    } catch {
      continue;
    }

    let spec: ReturnType<typeof parseSpec>;
    let tasks: ReturnType<typeof parseTasks>;
    try {
      spec = parseSpec(specMd);
      tasks = parseTasks(tasksMd);
    } catch {
      continue;
    }

    if (requested === "blocked" && spec.frontmatter.status.state !== "BLOCKED") continue;

    const ownerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "owner");
    const owner = ownerField?.[1] ?? "";

    if (input.mine === true && ctx.principal !== undefined && owner !== ctx.principal) continue;

    const approvedField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "approved");
    const approved_dtg = approvedField?.[1] && approvedField[1] !== "TBD" ? approvedField[1] : null;

    const ratified =
      spec.qTable.length > 0 && spec.qTable.every((r) => r.ratified.toLowerCase() !== "tbd");

    const remaining = (priority: "P0" | "P1" | "P2"): number =>
      tasks.phases[priority].filter((t) => !t.checked).length;

    let checked = 0;
    let total = 0;
    for (const p of ["P0", "P1", "P2"] as const) {
      total += tasks.phases[p].length;
      checked += tasks.phases[p].filter((t) => t.checked).length;
    }

    entries.push({
      slug: loc.slug,
      state: spec.frontmatter.status.state,
      dtg: spec.frontmatter.status.dtg,
      owner,
      approved_dtg,
      ratified,
      p0_remaining: remaining("P0"),
      p1_remaining: remaining("P1"),
      p2_remaining: remaining("P2"),
      blockers: [],
      tasks: { checked, total },
    });
  }

  if (input.mine === true) {
    entries.sort(
      (a, b) =>
        a.p0_remaining +
        a.p1_remaining +
        a.p2_remaining -
        (b.p0_remaining + b.p1_remaining + b.p2_remaining),
    );
  } else {
    entries.sort((a, b) => b.dtg.localeCompare(a.dtg));
  }

  const offset = Math.max(0, input.offset ?? 0);
  const limit = input.limit !== undefined && input.limit >= 0 ? input.limit : undefined;
  const sliced =
    limit !== undefined ? entries.slice(offset, offset + limit) : entries.slice(offset);

  if (input.slim === true) {
    return sliced.map(
      (e): SpecListSlimEntry => ({
        slug: e.slug,
        state: e.state,
        dtg: e.dtg,
        owner: e.owner,
        p0: e.p0_remaining,
        p1: e.p1_remaining,
        p2: e.p2_remaining,
        tasks: e.tasks,
      }),
    );
  }

  return sliced;
}
