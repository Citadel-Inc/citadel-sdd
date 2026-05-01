import type {
  Frontmatter,
  ParsedSpec,
  ParsedTasks,
  PhaseMap,
  Priority,
  QTableRow,
  SpecState,
  StatusValue,
  TaskItem,
} from "./types.js";

export function mutateStatus(fm: Frontmatter, next: StatusValue): Frontmatter {
  const fields = fm.fields.map(([k, v]) =>
    k.toLowerCase() === "status"
      ? ([k, formatStatusForFrontmatter(next)] as readonly [string, string])
      : ([k, v] as readonly [string, string]),
  );
  return { status: next, fields };
}

function formatStatusForFrontmatter(s: StatusValue): string {
  if (s.tail.length === 0) return `${s.state} ${s.dtg}`;
  return `${s.state} ${s.dtg} — ${s.tail}`;
}

export function mutateField(fm: Frontmatter, key: string, value: string): Frontmatter {
  const lowerKey = key.toLowerCase();
  let found = false;
  const fields = fm.fields.map(([k, v]) => {
    if (k.toLowerCase() === lowerKey) {
      found = true;
      return [k, value] as readonly [string, string];
    }
    return [k, v] as readonly [string, string];
  });
  if (!found) {
    fields.push([key, value] as readonly [string, string]);
  }
  return { ...fm, fields };
}

export interface RatifyDecision {
  text: string;
  as_of_dtg?: string;
}

export interface RatifyOptions {
  decisions?: Record<string, RatifyDecision>;
  default_disposition: string;
  dtg: string;
}

export function ratifyQTable(rows: readonly QTableRow[], opts: RatifyOptions): QTableRow[] {
  return rows.map((row) => {
    if (row.ratified.toLowerCase() !== "tbd") return row;
    const decision = opts.decisions?.[row.id];
    if (decision !== undefined) {
      return { ...row, ratified: decision.text };
    }
    return { ...row, ratified: opts.default_disposition };
  });
}

export interface TaskMatch {
  phase: Priority;
  match: string | number;
}

export function findTaskIndex(tasks: ParsedTasks, m: TaskMatch): number {
  const items = tasks.phases[m.phase];
  if (typeof m.match === "number") {
    const idx = m.match - 1;
    if (idx < 0 || idx >= items.length) return -1;
    return idx;
  }
  const needle = m.match;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.text.startsWith(needle)) return i;
  }
  return -1;
}

export function setTaskChecked(tasks: ParsedTasks, m: TaskMatch, checked: boolean): ParsedTasks {
  const idx = findTaskIndex(tasks, m);
  if (idx === -1) {
    throw new Error(`task_not_found: phase=${m.phase} match=${String(m.match)}`);
  }
  const phase = m.phase;
  const items = tasks.phases[phase].slice();
  const target = items[idx];
  if (!target) throw new Error("task_not_found: index resolved to undefined");
  items[idx] = { ...target, checked };
  const phases: PhaseMap = { ...tasks.phases, [phase]: items };
  return { ...tasks, phases };
}

export function addTaskItem(
  tasks: ParsedTasks,
  phase: Priority,
  text: string,
  blocker = false,
): ParsedTasks {
  const newItem: TaskItem = {
    checked: false,
    text: blocker ? (text.startsWith("[BLOCKED]") ? text : `[BLOCKED] ${text}`) : text,
    isHumanGate: text.trimStart().startsWith("[HUMAN]"),
  };
  const items = [...tasks.phases[phase], newItem];
  const phases: PhaseMap = { ...tasks.phases, [phase]: items };
  return { ...tasks, phases };
}

export function setOwner(spec: ParsedSpec, owner: string): ParsedSpec {
  const fm = mutateField(spec.frontmatter, "Owner", owner);
  return { ...spec, frontmatter: fm };
}

export function ratifySpec(spec: ParsedSpec, opts: RatifyOptions): ParsedSpec {
  return { ...spec, qTable: ratifyQTable(spec.qTable, opts) };
}

export function setStatusOnSpec(spec: ParsedSpec, next: StatusValue): ParsedSpec {
  return { ...spec, frontmatter: mutateStatus(spec.frontmatter, next) };
}

export function setStatusOnTasks(tasks: ParsedTasks, next: StatusValue): ParsedTasks {
  return { ...tasks, frontmatter: mutateStatus(tasks.frontmatter, next) };
}

export type { Priority, SpecState, StatusValue };
