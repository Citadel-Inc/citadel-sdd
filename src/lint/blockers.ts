import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface BlockerEntry {
  dtg: string;
  title: string;
  body: string;
  isStub: boolean;
  daysSinceUtc: number | null;
  referencedSpecs: string[];
}

export interface BlockerFile {
  path: string;
  rawText: string;
  count: number;
  entries: BlockerEntry[];
}

const RE_HEADING = /^###\s+(\S+)\s+[—-]\s+(.+)$/;
const RE_RESOLVED = /\bRESOLVED\b|\bresolved on\b|\bSUPERSEDED\b|\bCLOSED\b/i;
const RE_DTG_MIL = /^(\d{2})(\d{2})(\d{2})Z([A-Z]{3})(\d{2})$/;
const MONTHS_MIL: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

function parseDtgUtc(dtg: string): Date | null {
  const m = RE_DTG_MIL.exec(dtg);
  if (!m) return null;
  const dd = Number.parseInt(m[1] ?? "", 10);
  const hh = Number.parseInt(m[2] ?? "", 10);
  const mm = Number.parseInt(m[3] ?? "", 10);
  const mon = MONTHS_MIL[m[4] ?? ""];
  const yy = Number.parseInt(m[5] ?? "", 10);
  if (Number.isNaN(dd) || Number.isNaN(hh) || mon === undefined || Number.isNaN(yy)) return null;
  return new Date(Date.UTC(2000 + yy, mon, dd, hh, mm, 0));
}

function daysSince(then: Date, now: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function parseBlockers(rootDir: string, now: Date = new Date()): BlockerFile | null {
  const path = join(rootDir, "HUMAN_BLOCKERS.md");
  if (!existsSync(path)) return null;
  let rawText: string;
  try {
    rawText = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = rawText.split(/\r?\n/);
  const entries: BlockerEntry[] = [];
  let current: { dtg: string; title: string; bodyLines: string[] } | null = null;

  for (const raw of lines) {
    const m = RE_HEADING.exec(raw);
    if (m) {
      if (current !== null) {
        entries.push(buildEntry(current, now));
      }
      current = { dtg: m[1] ?? "", title: m[2] ?? "", bodyLines: [] };
    } else if (current !== null) {
      current.bodyLines.push(raw);
    }
  }
  if (current !== null) {
    entries.push(buildEntry(current, now));
  }

  return { path, rawText, count: entries.length, entries };
}

function buildEntry(
  cur: { dtg: string; title: string; bodyLines: string[] },
  now: Date,
): BlockerEntry {
  const body = cur.bodyLines.join("\n").trim();
  const isStub = body.length === 0 || RE_RESOLVED.test(body);
  const dtgDate = parseDtgUtc(cur.dtg);
  const daysSinceUtc = dtgDate !== null ? daysSince(dtgDate, now) : null;
  const referencedSpecs = extractReferencedSpecs(body);
  return { dtg: cur.dtg, title: cur.title, body, isStub, daysSinceUtc, referencedSpecs };
}

function extractReferencedSpecs(body: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:fe|go|docs|cli)-[a-z0-9-]+/g;
  for (const m of body.matchAll(re)) {
    if (m[0]) out.add(m[0]);
  }
  return [...out];
}

export interface BlockerLintFinding {
  category: "blocker-stale" | "blocker-stub" | "blocker-orphan";
  message: string;
}

export const BLOCKER_STALE_DAYS = 7;

export function blockerLint(
  blockers: BlockerFile,
  options: {
    activeSlugs: ReadonlySet<string>;
    activeSlugsWithOpenHuman: ReadonlySet<string>;
  },
): BlockerLintFinding[] {
  const findings: BlockerLintFinding[] = [];
  for (const e of blockers.entries) {
    if (e.daysSinceUtc !== null && e.daysSinceUtc >= BLOCKER_STALE_DAYS) {
      findings.push({
        category: "blocker-stale",
        message: `HUMAN_BLOCKERS.md: ${e.dtg} — ${e.title} is ${e.daysSinceUtc}d old (>= ${BLOCKER_STALE_DAYS}d)`,
      });
    }
    if (e.isStub) {
      findings.push({
        category: "blocker-stub",
        message: `HUMAN_BLOCKERS.md: ${e.dtg} — ${e.title} is a stub (empty / RESOLVED / SUPERSEDED) — prune it`,
      });
    }
    for (const slug of e.referencedSpecs) {
      if (!options.activeSlugs.has(slug)) {
        findings.push({
          category: "blocker-orphan",
          message: `HUMAN_BLOCKERS.md: ${e.dtg} — references "${slug}" which is not in specs/active/`,
        });
      } else if (!options.activeSlugsWithOpenHuman.has(slug)) {
        findings.push({
          category: "blocker-orphan",
          message: `HUMAN_BLOCKERS.md: ${e.dtg} — references "${slug}" but that spec has no open [HUMAN] task`,
        });
      }
    }
  }
  return findings;
}

export const BLOCKER_CATEGORIES: ReadonlyArray<string> = [
  "blocker-stale",
  "blocker-stub",
  "blocker-orphan",
];
