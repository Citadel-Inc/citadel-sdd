export type SpecState = "DRAFT" | "APPROVED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "PARKED";

export type Priority = "P0" | "P1" | "P2";

export interface StatusValue {
  state: SpecState;
  dtg: string;
  tail: string;
  bold?: boolean;
}

export interface Frontmatter {
  status: StatusValue;
  fields: ReadonlyArray<readonly [string, string]>;
}

export interface QTableRow {
  id: string;
  question: string;
  proposedDefault: string;
  ratified: string;
}

export interface TaskItem {
  checked: boolean;
  text: string;
  isHumanGate: boolean;
}

export interface PhaseMap {
  P0: TaskItem[];
  P1: TaskItem[];
  P2: TaskItem[];
}

export interface ParsedSpec {
  frontmatter: Frontmatter;
  qTable: QTableRow[];
  raw: string;
}

export interface ParsedTasks {
  frontmatter: Frontmatter;
  phases: PhaseMap;
  raw: string;
}

export const SPEC_STATES: ReadonlySet<SpecState> = new Set([
  "DRAFT",
  "APPROVED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "PARKED",
]);

export const PRIORITIES: ReadonlyArray<Priority> = ["P0", "P1", "P2"];
