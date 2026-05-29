import type {
  Frontmatter,
  ParsedTasks,
  PhaseMap,
  Priority,
  QTableRow,
  StatusValue,
  TaskItem,
} from "./types.js";
import { PRIORITIES } from "./types.js";

export function renderStatusValue(s: StatusValue): string {
  const stateStr = s.dtg ? `${s.state} ${s.dtg}` : s.state;
  const head = s.bold ? `**${stateStr}**` : stateStr;
  if (!s.tail) return head;
  return `${head} — ${s.tail}`;
}

function escapePipeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function renderFrontmatter(fm: Frontmatter): string {
  const lines: string[] = ["| | |", "|---|---|"];
  let statusEmitted = false;
  for (const [key, value] of fm.fields) {
    if (key.toLowerCase() === "status") {
      lines.push(`| Status | ${escapePipeCell(renderStatusValue(fm.status))} |`);
      statusEmitted = true;
    } else {
      lines.push(`| ${key} | ${escapePipeCell(value)} |`);
    }
  }
  if (!statusEmitted) {
    lines.splice(2, 0, `| Status | ${escapePipeCell(renderStatusValue(fm.status))} |`);
  }
  return lines.join("\n");
}

export function renderFrontmatterInline(fm: Frontmatter): string {
  const lines: string[] = [];
  let statusEmitted = false;
  for (const [key, value] of fm.fields) {
    if (key.toLowerCase() === "status") {
      lines.push(`Status: ${renderStatusValue(fm.status)}`);
      statusEmitted = true;
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  if (!statusEmitted) {
    lines.unshift(`Status: ${renderStatusValue(fm.status)}`);
  }
  return lines.join("\n");
}

export function renderQTable(rows: readonly QTableRow[]): string {
  if (rows.length === 0) return "";
  const lines: string[] = [
    "| # | Question | Proposed default | NOMAD |",
    "|---|----------|------------------|-------|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.id} | ${escapePipeCell(row.question)} | ${escapePipeCell(row.proposedDefault)} | ${escapePipeCell(row.ratified)} |`,
    );
  }
  return lines.join("\n");
}

export function renderTaskItem(item: TaskItem): string {
  const box = item.checked ? "[x]" : "[ ]";
  return `- ${box} ${item.text}`;
}

export function renderPhase(priority: Priority, items: readonly TaskItem[]): string {
  const lines: string[] = [`## ${priority}`, ""];
  for (const item of items) {
    lines.push(renderTaskItem(item));
  }
  return lines.join("\n");
}

export function renderTasks(t: ParsedTasks): string {
  const fm = renderFrontmatter(t.frontmatter);
  const phases = PRIORITIES.map((p) => renderPhase(p, t.phases[p as keyof PhaseMap])).join("\n\n");
  return `${fm}\n\n${phases}\n`;
}
