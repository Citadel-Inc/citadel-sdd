import {
  type Frontmatter,
  type ParsedSpec,
  type ParsedTasks,
  type PhaseMap,
  type Priority,
  type QTableRow,
  SPEC_STATES,
  type SpecState,
  type StatusValue,
} from "./types.js";

interface PipeTableExtraction {
  rows: string[][];
  startIdx: number;
  endIdx: number;
}

function findFirstPipeLine(lines: readonly string[], from = 0): number {
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim().startsWith("|")) return i;
  }
  return -1;
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function extractPipeTable(lines: readonly string[], startIdx: number): PipeTableExtraction {
  const rows: string[][] = [];
  let i = startIdx;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw === undefined) break;
    const line = raw.trim();
    if (!line.startsWith("|")) break;
    if (isSeparatorRow(line)) {
      i++;
      continue;
    }
    const inner = line.replace(/^\|/, "").replace(/\|$/, "");
    const cells = inner.split("|").map((c) => c.trim());
    rows.push(cells);
    i++;
  }
  return { rows, startIdx, endIdx: i };
}

export function parseStatusValue(raw: string): StatusValue {
  const trimmed = raw.trim();
  const match = /^([A-Z_]+)\s+(\S+)(?:\s+[—-]\s+(.*))?$/.exec(trimmed);
  if (!match) {
    throw new Error(`status_unparseable: "${raw}"`);
  }
  const state = match[1] as SpecState;
  if (!SPEC_STATES.has(state)) {
    throw new Error(`state_unknown: "${state}"`);
  }
  return { state, dtg: match[2] ?? "", tail: match[3] ?? "" };
}

export function parseFrontmatter(md: string): Frontmatter {
  const lines = md.split(/\r?\n/);
  const startIdx = findFirstPipeLine(lines);
  if (startIdx === -1) {
    throw new Error("frontmatter_missing");
  }
  const { rows } = extractPipeTable(lines, startIdx);
  const fields: Array<readonly [string, string]> = [];
  let status: StatusValue | null = null;
  for (const row of rows) {
    if (row.length !== 2) continue;
    const key = row[0];
    const value = row[1];
    if (key === undefined || value === undefined) continue;
    if (!key) continue;
    fields.push([key, value] as const);
    if (key.toLowerCase() === "status") {
      status = parseStatusValue(value);
    }
  }
  if (!status) {
    throw new Error("frontmatter_status_missing");
  }
  return { status, fields };
}

export function parseQTable(md: string): QTableRow[] {
  const lines = md.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw === undefined) continue;
    const line = raw.trim();
    if (
      line.startsWith("|") &&
      /question/i.test(line) &&
      /proposed\s*default/i.test(line) &&
      /nomad/i.test(line)
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];
  const { rows } = extractPipeTable(lines, headerIdx);
  const dataRows = rows.slice(1);
  const out: QTableRow[] = [];
  for (const row of dataRows) {
    if (row.length !== 4) continue;
    const id = row[0];
    const question = row[1];
    const proposedDefault = row[2];
    const ratified = row[3];
    if (
      id === undefined ||
      question === undefined ||
      proposedDefault === undefined ||
      ratified === undefined
    ) {
      continue;
    }
    out.push({ id, question, proposedDefault, ratified });
  }
  return out;
}

export function parseTasks(md: string): ParsedTasks {
  const frontmatter = parseFrontmatter(md);
  const lines = md.split(/\r?\n/);
  const phases: PhaseMap = { P0: [], P1: [], P2: [] };
  let current: Priority | null = null;
  for (const raw of lines) {
    if (raw === undefined) continue;
    const line = raw;
    const phaseMatch = /^##\s+(P[012])\b/.exec(line);
    if (phaseMatch) {
      const tag = phaseMatch[1];
      if (tag === "P0" || tag === "P1" || tag === "P2") {
        current = tag;
      } else {
        current = null;
      }
      continue;
    }
    if (/^##\s+/.test(line)) {
      current = null;
      continue;
    }
    if (current === null) continue;
    const itemMatch = /^- \[([ xX])\] (.*)$/.exec(line);
    if (itemMatch) {
      const mark = itemMatch[1];
      const text = itemMatch[2];
      if (mark === undefined || text === undefined) continue;
      phases[current].push({
        checked: mark.toLowerCase() === "x",
        text,
        isHumanGate: text.trimStart().startsWith("[HUMAN]"),
      });
    }
  }
  return { frontmatter, phases, raw: md };
}

export function parseSpec(md: string): ParsedSpec {
  const frontmatter = parseFrontmatter(md);
  const qTable = parseQTable(md);
  return { frontmatter, qTable, raw: md };
}
