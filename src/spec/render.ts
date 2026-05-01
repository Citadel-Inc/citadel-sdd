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
  const head = s.bold ? `**${s.state} ${s.dtg}**` : `${s.state} ${s.dtg}`;
  if (s.tail.length === 0) return head;
  return `${head} — ${s.tail}`;
}

export function renderFrontmatter(fm: Frontmatter): string {
  const lines: string[] = ["| | |", "|---|---|"];
  let statusEmitted = false;
  for (const [key, value] of fm.fields) {
    if (key.toLowerCase() === "status") {
      lines.push(`| Status | ${renderStatusValue(fm.status)} |`);
      statusEmitted = true;
    } else {
      lines.push(`| ${key} | ${value} |`);
    }
  }
  if (!statusEmitted) {
    lines.splice(2, 0, `| Status | ${renderStatusValue(fm.status)} |`);
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
    lines.push(`| ${row.id} | ${row.question} | ${row.proposedDefault} | ${row.ratified} |`);
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
