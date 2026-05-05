import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTasks } from "../spec/parse.js";
import { listSpecs, type RepoContext, type SpecLocation, specsRoot } from "../spec/repo.js";
import { BLOCKER_CATEGORIES, blockerLint, parseBlockers } from "./blockers.js";

export interface CrossCuttingFinding {
  category: string;
  message: string;
  slug?: string;
}

interface SpecSummary {
  loc: SpecLocation;
  open: number;
  done: number;
  human: number;
}

function summarize(loc: SpecLocation): SpecSummary | null {
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
  return { loc, open, done, human };
}

function readIndex(
  rootDir: string,
  specDir: string,
): {
  active: Set<string>;
  done: Set<string>;
  parked: Set<string>;
} {
  const path = join(rootDir, specDir, "README.md");
  const out = { active: new Set<string>(), done: new Set<string>(), parked: new Set<string>() };
  if (!existsSync(path)) return out;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  const lines = text.split(/\r?\n/);
  let section: "active" | "done" | "parked" | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+Active\b/i.test(line)) {
      section = "active";
      continue;
    }
    if (/^##\s+Done\b/i.test(line)) {
      section = "done";
      continue;
    }
    if (/^##\s+Parked\b/i.test(line)) {
      section = "parked";
      continue;
    }
    if (/^##\s+/.test(line)) {
      section = null;
      continue;
    }
    if (section === null) continue;
    const m = /^\|\s+([a-z0-9][a-z0-9-]*)\s*\|/.exec(line);
    if (m?.[1]) out[section].add(m[1]);
  }
  return out;
}

function readBlockersText(rootDir: string): string | null {
  const path = join(rootDir, "HUMAN_BLOCKERS.md");
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function crossCutting(repo: RepoContext): CrossCuttingFinding[] {
  const findings: CrossCuttingFinding[] = [];
  specsRoot(repo);

  const active = listSpecs(repo, "active");
  const done = listSpecs(repo, "done");
  const parked = listSpecs(repo, "parked");
  const activeSummaries = active.map(summarize).filter((s): s is SpecSummary => s !== null);

  for (const s of activeSummaries) {
    if (s.open === 0 && s.done > 0 && s.human === 0) {
      findings.push({
        category: "ready-to-close",
        slug: s.loc.slug,
        message: `${s.loc.slug}: ready to close (open=0, human=0) — move to specs/done/`,
      });
    }
  }

  const index = readIndex(repo.rootDir, repo.specDir);
  const activeNames = new Set(active.map((l) => l.slug));
  const doneNames = new Set(done.map((l) => l.slug));
  const parkedNames = new Set(parked.map((l) => l.slug));

  const runIndexParity =
    activeNames.size > 0 ||
    doneNames.size > 0 ||
    parkedNames.size > 0 ||
    index.active.size > 0 ||
    index.done.size > 0 ||
    index.parked.size > 0;

  if (runIndexParity) {
    for (const slug of activeNames) {
      if (!index.active.has(slug)) {
        findings.push({
          category: "not-indexed",
          slug,
          message: `${slug}: in specs/active/ but missing from specs/README.md Active table`,
        });
      }
    }
    for (const slug of index.active) {
      if (!activeNames.has(slug)) {
        findings.push({
          category: "orphan-indexed",
          slug,
          message: `${slug}: listed in specs/README.md Active but not in specs/active/`,
        });
      }
    }
    for (const slug of doneNames) {
      if (index.done.size > 0 && !index.done.has(slug)) {
        findings.push({
          category: "orphan-done",
          slug,
          message: `${slug}: in specs/done/ but missing from specs/README.md Done table`,
        });
      }
    }
    for (const slug of index.done) {
      if (!doneNames.has(slug)) {
        findings.push({
          category: "orphan-done",
          slug,
          message: `${slug}: listed in specs/README.md Done but not in specs/done/`,
        });
      }
    }
    for (const slug of parkedNames) {
      if (!index.parked.has(slug)) {
        findings.push({
          category: "orphan-parked",
          slug,
          message: `${slug}: in specs/parked/ but missing from specs/README.md Parked table`,
        });
      }
    }
    for (const slug of index.parked) {
      if (!parkedNames.has(slug)) {
        findings.push({
          category: "orphan-parked",
          slug,
          message: `${slug}: listed in specs/README.md Parked but not in specs/parked/`,
        });
      }
    }
  }

  const blockersText = readBlockersText(repo.rootDir);
  if (blockersText !== null) {
    for (const s of activeSummaries) {
      if (s.human > 0 && !blockersText.includes(s.loc.slug)) {
        findings.push({
          category: "human-uncrossed",
          slug: s.loc.slug,
          message: `${s.loc.slug}: ${s.human} HUMAN task(s) in tasks.md but spec name not referenced in HUMAN_BLOCKERS.md`,
        });
      }
    }
  }

  const blockers = parseBlockers(repo.rootDir);
  if (blockers !== null) {
    const activeSlugs = new Set(active.map((l) => l.slug));
    const activeSlugsWithOpenHuman = new Set(
      activeSummaries.filter((s) => s.human > 0).map((s) => s.loc.slug),
    );
    for (const f of blockerLint(blockers, { activeSlugs, activeSlugsWithOpenHuman })) {
      findings.push({ category: f.category, message: f.message });
    }
  }

  return findings;
}

export const CROSS_CUTTING_CATEGORIES: ReadonlyArray<string> = [
  "ready-to-close",
  "not-indexed",
  "orphan-indexed",
  "orphan-done",
  "orphan-parked",
  "human-uncrossed",
  ...BLOCKER_CATEGORIES,
];
