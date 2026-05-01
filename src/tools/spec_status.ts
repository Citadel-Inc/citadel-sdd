import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ClosureReason, computeClosureReason, readClosureCounts } from "../lint/closure.js";
import { type ChecklistCounts, scanChecklist } from "../spec/checklist_scan.js";
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
  reason?: ClosureReason;
  by_source?: Partial<Record<"tasks" | "plan" | "spec", ChecklistCounts>>;
  recent_commits?: string[];
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
  if (input.recent_limit !== undefined && input.recent_limit > 0) {
    const lines = recentCommits({
      metaRoot: ctx.rootDir,
      specsRoot,
      section: loc.state,
      slug: loc.slug,
      limit: input.recent_limit,
      since: input.since,
    });
    if (lines.length > 0) out.recent_commits = lines;
  }

  if (loc.state === "active") {
    const counts = readClosureCounts(loc);
    if (counts !== null) {
      const indexedActive = readIndexedActive(ctx.rootDir, ctx.profile.spec_dir);
      out.reason = computeClosureReason(counts, { slug: loc.slug, indexedActive });
    }
  }

  const bySource: Partial<Record<"tasks" | "plan" | "spec", ChecklistCounts>> = {};
  for (const [key, abs] of [
    ["tasks", loc.tasksMd],
    ["plan", loc.planMd],
    ["spec", loc.specMd],
  ] as const) {
    let text: string;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const counts = scanChecklist(text);
    if (counts.open > 0 || counts.done > 0) {
      bySource[key] = counts;
    }
  }
  if (Object.keys(bySource).length > 0) out.by_source = bySource;

  return out;
}

function readIndexedActive(rootDir: string, specDir: string): ReadonlySet<string> {
  const path = join(rootDir, specDir, "README.md");
  const out = new Set<string>();
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  const lines = text.split(/\r?\n/);
  let inActive = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+Active\b/i.test(line)) {
      inActive = true;
      continue;
    }
    if (/^##\s+/.test(line)) {
      inActive = false;
      continue;
    }
    if (!inActive) continue;
    const m = /^\|\s+([a-z0-9][a-z0-9-]*)\s*\|/.exec(line);
    if (m?.[1]) out.add(m[1]);
  }
  return out;
}
