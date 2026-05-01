import { readFileSync } from "node:fs";
import { join } from "node:path";
import { daysBetween, lastTouchedBulk, recentCommits } from "../spec/git_history.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import type { QTableRow, SpecState } from "../spec/types.js";
import type { ToolContext } from "./types.js";

export interface SpecStatusInput {
  slug: string;
  recent_limit?: number;
  since?: string;
}

export interface PhaseTaskCount {
  open: number;
  done: number;
}

export interface SpecStatusOutput {
  slug: string;
  state: SpecState;
  dtg: string;
  owner: string;
  approved_dtg: string | null;
  ratified: boolean;
  q_table: QTableRow[];
  task_counts: { P0: PhaseTaskCount; P1: PhaseTaskCount; P2: PhaseTaskCount };
  blockers: string[];
  last_touched?: string;
  days_since?: number;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specStatus(input: SpecStatusInput, ctx: ToolContext): SpecStatusOutput {
  const loc = locateSpec(repoCtx(ctx), input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const spec = parseSpec(readFileSync(loc.specMd, "utf8"));
  const tasks = parseTasks(readFileSync(loc.tasksMd, "utf8"));

  const ownerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "owner");
  const approvedField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "approved");

  const approved_dtg = approvedField?.[1] && approvedField[1] !== "TBD" ? approvedField[1] : null;

  const ratified =
    spec.qTable.length > 0 && spec.qTable.every((r) => r.ratified.toLowerCase() !== "tbd");

  const count = (p: "P0" | "P1" | "P2"): PhaseTaskCount => {
    const items = tasks.phases[p];
    const done = items.filter((t) => t.checked).length;
    return { done, open: items.length - done };
  };

  const blockers: string[] = [];
  if (spec.frontmatter.status.state === "BLOCKED" && spec.frontmatter.status.tail) {
    blockers.push(spec.frontmatter.status.tail);
  }

  const out: SpecStatusOutput = {
    slug: loc.slug,
    state: spec.frontmatter.status.state,
    dtg: spec.frontmatter.status.dtg,
    owner: ownerField?.[1] ?? "",
    approved_dtg,
    ratified,
    q_table: spec.qTable,
    task_counts: { P0: count("P0"), P1: count("P1"), P2: count("P2") },
    blockers,
  };

  const specsRoot = join(ctx.rootDir, ctx.profile.spec_dir);
  const map = lastTouchedBulk({
    metaRoot: ctx.rootDir,
    specsRoot,
    section: loc.state,
  });
  const last = map.get(loc.slug);
  if (last !== undefined) {
    out.last_touched = last;
    const today = ctx.clock ? ctx.clock() : new Date();
    const days = daysBetween(last, today);
    if (days !== null) out.days_since = days;
  }
  void recentCommits; // wired in T7

  return out;
}
