import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTasks } from "../spec/parse.js";
import type { SpecLocation } from "../spec/repo.js";

export type ClosureReason =
  | "ready"
  | "uninitialised"
  | "open_human"
  | "open_tasks"
  | "progress_file"
  | "not_indexed";

export interface ClosureCounts {
  open: number;
  done: number;
  human: number;
  hasProgress: boolean;
}

export function readClosureCounts(loc: SpecLocation): ClosureCounts | null {
  let raw: string;
  try {
    raw = readFileSync(loc.tasksMd, "utf8");
  } catch {
    return null;
  }
  let parsed: ReturnType<typeof parseTasks>;
  try {
    parsed = parseTasks(raw);
  } catch {
    return null;
  }
  const all = [...parsed.phases.P0, ...parsed.phases.P1, ...parsed.phases.P2];
  const open = all.filter((t) => !t.checked).length;
  const done = all.filter((t) => t.checked).length;
  const human = all.filter((t) => t.isHumanGate && !t.checked).length;
  const hasProgress =
    existsSync(join(loc.dir, "progress.md")) || existsSync(join(loc.dir, "PROGRESS.md"));
  return { open, done, human, hasProgress };
}

export function computeClosureReason(
  counts: ClosureCounts,
  opts: { slug: string; indexedActive?: ReadonlySet<string> },
): ClosureReason {
  if (counts.done === 0 && counts.open === 0) return "uninitialised";
  if (counts.human > 0) return "open_human";
  if (counts.open > 0) return "open_tasks";
  if (counts.hasProgress) return "progress_file";
  if (opts.indexedActive && opts.indexedActive.size > 0 && !opts.indexedActive.has(opts.slug)) {
    return "not_indexed";
  }
  return "ready";
}
