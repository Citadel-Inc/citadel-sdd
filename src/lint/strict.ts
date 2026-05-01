export type StrictCategory =
  | "strict-bullets"
  | "strict-numbered-checklist"
  | "strict-alt-state"
  | "strict-alt-marker"
  | "strict-frontmatter"
  | "strict-frontmatter-format"
  | "strict-priority-heading"
  | "strict-priority-in-nontasks";

export interface StrictFinding {
  category: StrictCategory;
  message: string;
  line: number;
  filename: string;
}

const RE_STRICT_STAR_BULLET = /^\s*\*\s*\[[ xX]\]/;
const RE_STRICT_NUMBERED_CHECKLIST = /^\s*\d+\.\s*\[[ xX]\]/;
const RE_STRICT_ALT_STATE = /^\s*-\s*\[[/~?]\]/;
const RE_STRICT_ALT_MARKER =
  /^\s*-\s*\[[\sxX]\].*\[(BLOCKED|NCA|NEEDS-DECISION|NEEDS_DECISION|TODO|WIP|WAIT)\]/;
const RE_STRICT_FRONTMATTER_OPEN = /^---\s*$/;
const RE_STRICT_FRONTMATTER_OPEN_TOML = /^\+\+\+\s*$/;
const RE_STRICT_PRIORITY_WORD = /^\s{0,3}##\s+Priority\b/i;
const RE_STRICT_PHASE_HEADING = /^\s{0,3}#{2,3}\s+Phase\s+\d+\b/i;
const RE_PRIORITY_HEADING = /^\s{0,3}##\s+(P-?\d+)\b/;

export function scanStrictFile(filename: string, text: string): StrictFinding[] {
  const findings: StrictFinding[] = [];
  const lines = text.split(/\r?\n/);

  if (lines.length > 0) {
    const first = lines[0] ?? "";
    if (RE_STRICT_FRONTMATTER_OPEN.test(first) || RE_STRICT_FRONTMATTER_OPEN_TOML.test(first)) {
      findings.push({
        category: "strict-frontmatter",
        line: 1,
        filename,
        message: `${filename}:1: frontmatter fence at top of file — Bastion specs use prose, not YAML/TOML frontmatter`,
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNum = i + 1;
    if (RE_STRICT_STAR_BULLET.test(line)) {
      findings.push({
        category: "strict-bullets",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: non-canonical bullet '*' — use '-' for checklist items`,
      });
      continue;
    }
    if (RE_STRICT_NUMBERED_CHECKLIST.test(line)) {
      findings.push({
        category: "strict-numbered-checklist",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: numbered-list checkbox — use '- [ ]' / '- [x]' bullets`,
      });
      continue;
    }
    if (RE_STRICT_ALT_STATE.test(line)) {
      findings.push({
        category: "strict-alt-state",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: non-canonical checkbox state ('[/]', '[~]', '[?]') — use '[ ]' or '[x]'`,
      });
      continue;
    }
    if (RE_STRICT_ALT_MARKER.test(line)) {
      findings.push({
        category: "strict-alt-marker",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: non-canonical marker (e.g. [BLOCKED]/[NCA]/[NEEDS-DECISION]) — use [HUMAN]`,
      });
      continue;
    }
    if (RE_STRICT_PRIORITY_WORD.test(line)) {
      findings.push({
        category: "strict-priority-heading",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: '## Priority N' heading — use '## P<n>' (e.g. '## P0')`,
      });
      continue;
    }
    if (RE_STRICT_PHASE_HEADING.test(line)) {
      findings.push({
        category: "strict-priority-heading",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: '## Phase N' heading — use '## P<n>' for priority buckets`,
      });
    }
  }

  return findings;
}

export function scanPriorityInNontasks(filename: string, text: string): StrictFinding[] {
  const findings: StrictFinding[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = RE_PRIORITY_HEADING.exec(line);
    if (m) {
      const lineNum = i + 1;
      findings.push({
        category: "strict-priority-in-nontasks",
        line: lineNum,
        filename,
        message: `${filename}:${lineNum}: priority heading '${m[1]}' outside tasks.md — move to tasks.md or rename`,
      });
    }
  }
  return findings;
}

export const ALL_STRICT_CATEGORIES: ReadonlyArray<StrictCategory> = [
  "strict-bullets",
  "strict-numbered-checklist",
  "strict-alt-state",
  "strict-alt-marker",
  "strict-frontmatter",
  "strict-frontmatter-format",
  "strict-priority-heading",
  "strict-priority-in-nontasks",
];
