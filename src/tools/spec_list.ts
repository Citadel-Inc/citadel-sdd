import { readFileSync } from "node:fs";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { listSpecs, type RepoContext } from "../spec/repo.js";
import type { SpecState } from "../spec/types.js";
import type { ToolContext } from "./types.js";

export interface SpecListInput {
  state?: "active" | "done" | "blocked" | "all";
  mine?: boolean;
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
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specList(input: SpecListInput, ctx: ToolContext): SpecListEntry[] {
  const requested = input.state ?? "active";
  const dirScope = requested === "blocked" || requested === "all" ? "all" : requested;
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

  return entries;
}
