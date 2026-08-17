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

const SEPARATOR_ROW_RE = /^\|[\s:|-]+\|$/;
const LEADING_PIPE_RE = /^\|/;
const TRAILING_PIPE_RE = /\|$/;
const BOLD_WRAPPED_RE = /^\*\*([^*]+?)\*\*(.*)$/;
const STATUS_VALUE_RE = /^([A-Z_]+)(?:\s+(\S+)(?:\s+[—-]\s+(.*))?)?$/;
const LINE_SPLIT_RE = /\r?\n/;
const FRONTMATTER_FIELD_RE = /^([A-Z][A-Za-z _-]*?):\s+(.+)$/;
const Q_HEADER_QUESTION_RE = /question/i;
const Q_HEADER_DEFAULT_RE = /proposed\s*default/i;
const PHASE_HEADING_RE = /^##\s+(P[012])\b/;
const H2_RE = /^##\s+/;
const TASK_ITEM_RE = /^- \[([ xX])\] (.*)$/;

const STATE_ALIASES: Record<string, SpecState> = { CLOSED: "DONE" };

interface PipeTableExtraction {
  rows: string[][];
  startIdx: number;
  endIdx: number;
}

function findFirstPipeLine(lines: readonly string[], from = 0): number {
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    if (line.trim().startsWith("|")) {
      return i;
    }
  }
  return -1;
}

function isSeparatorRow(line: string): boolean {
  return SEPARATOR_ROW_RE.test(line.trim());
}

function splitPipeRow(line: string): string[] {
  const inner = line.replace(LEADING_PIPE_RE, "").replace(TRAILING_PIPE_RE, "");
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === "\\") {
      const next = inner[i + 1];
      if (next === "\\" || next === "|") {
        cell += next;
        i += 1;
      } else {
        cell += char;
      }
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function extractPipeTable(lines: readonly string[], startIdx: number): PipeTableExtraction {
  const rows: string[][] = [];
  let i = startIdx;
  while (i < lines.length) {
    const raw = lines[i];
    if (raw === undefined) {
      break;
    }
    const line = raw.trim();
    if (!line.startsWith("|")) {
      break;
    }
    if (isSeparatorRow(line)) {
      i += 1;
      continue;
    }
    rows.push(splitPipeRow(line));
    i += 1;
  }
  return { rows, startIdx, endIdx: i };
}

export function parseStatusValue(raw: string): StatusValue {
  let trimmed = raw.trim();
  let bold = false;

  // Strip markdown bold from the whole value (**STATE DTG — tail**)
  // or from the state word only (**STATE** DTG — tail).
  const boldMatch = BOLD_WRAPPED_RE.exec(trimmed);
  if (boldMatch) {
    bold = true;
    trimmed = `${boldMatch[1] ?? ""}${boldMatch[2] ?? ""}`.trim();
  }

  // DTG is optional — hand-written specs may omit it (e.g. "**DRAFT**" with no stamp).
  const match = STATUS_VALUE_RE.exec(trimmed);
  if (!match) {
    throw new Error(`status_unparseable: "${raw}"`);
  }
  const stateRaw = match[1] ?? "";
  const aliased = STATE_ALIASES[stateRaw];
  const state = (aliased ?? stateRaw) as SpecState;
  if (!SPEC_STATES.has(state)) {
    throw new Error(`state_unknown: "${stateRaw}" is not a recognised spec state`);
  }
  return { state, dtg: match[2] ?? "", tail: match[3] ?? "", bold };
}

function parseInlineFrontmatter(md: string): Frontmatter | null {
  const lines = md.split(LINE_SPLIT_RE);
  const fields: Array<readonly [string, string]> = [];
  let status: StatusValue | null = null;
  let pastTitle = false;
  for (const raw of lines) {
    if (raw === undefined) {
      continue;
    }
    // Skip the title line itself (first # heading), but note when we've seen it.
    if (!pastTitle && (raw.startsWith("# ") || raw.startsWith("## "))) {
      pastTitle = true;
      continue;
    }
    // Stop frontmatter scanning at the next heading after the title.
    if (pastTitle && (raw.startsWith("# ") || raw.startsWith("## "))) {
      break;
    }
    const m = FRONTMATTER_FIELD_RE.exec(raw);
    if (!m) {
      if (status !== null) {
        break;
      }
      continue;
    }
    const key = (m[1] ?? "").trim();
    const value = (m[2] ?? "").trim();
    if (!key) {
      continue;
    }
    fields.push([key, value] as const);
    if (key.toLowerCase() === "status") {
      try {
        status = parseStatusValue(value);
      } catch {
        return null;
      }
    }
  }
  if (!status) {
    return null;
  }
  return { status, fields };
}

export function parseFrontmatter(md: string): Frontmatter {
  const lines = md.split(LINE_SPLIT_RE);
  const startIdx = findFirstPipeLine(lines);
  if (startIdx === -1) {
    const inline = parseInlineFrontmatter(md);
    if (inline) {
      return inline;
    }
    throw new Error("frontmatter_missing");
  }
  const { rows } = extractPipeTable(lines, startIdx);
  const fields: Array<readonly [string, string]> = [];
  let status: StatusValue | null = null;
  for (const row of rows) {
    if (row.length !== 2) {
      continue;
    }
    const [key, value] = row;
    if (key === undefined || value === undefined) {
      continue;
    }
    if (!key) {
      continue;
    }
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
  const lines = md.split(LINE_SPLIT_RE);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (raw === undefined) {
      continue;
    }
    const line = raw.trim();
    if (line.startsWith("|") && Q_HEADER_QUESTION_RE.test(line) && Q_HEADER_DEFAULT_RE.test(line)) {
      // Require the very next line to be a markdown table separator row.
      const nextRaw = lines[i + 1];
      if (nextRaw === undefined || !isSeparatorRow(nextRaw.trim())) {
        continue;
      }
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return [];
  }
  const { rows } = extractPipeTable(lines, headerIdx);
  const dataRows = rows.slice(1);
  const out: QTableRow[] = [];
  for (const row of dataRows) {
    if (row.length !== 4) {
      continue;
    }
    const [id, question, proposedDefault, ratified] = row;
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
  const lines = md.split(LINE_SPLIT_RE);
  const phases: PhaseMap = { P0: [], P1: [], P2: [] };
  let current: Priority | null = null;
  for (const raw of lines) {
    if (raw === undefined) {
      continue;
    }
    const line = raw;
    const phaseMatch = PHASE_HEADING_RE.exec(line);
    if (phaseMatch) {
      const [, tag] = phaseMatch;
      if (tag === "P0" || tag === "P1" || tag === "P2") {
        current = tag;
      } else {
        current = null;
      }
      continue;
    }
    if (H2_RE.test(line)) {
      current = null;
      continue;
    }
    if (current === null) {
      continue;
    }
    const itemMatch = TASK_ITEM_RE.exec(line);
    if (itemMatch) {
      const [, mark, text] = itemMatch;
      if (mark === undefined || text === undefined) {
        continue;
      }
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
