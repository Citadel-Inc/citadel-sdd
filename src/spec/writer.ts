import { renderFrontmatter, renderQTable, renderTaskItem } from "./render.js";
import type { Frontmatter, ParsedSpec, ParsedTasks, Priority, QTableRow } from "./types.js";
import { PRIORITIES } from "./types.js";

interface BlockRange {
  start: number;
  end: number;
}

function findFirstPipeBlock(lines: readonly string[], from = 0): BlockRange | null {
  let start = -1;
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim().startsWith("|")) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = start;
  while (end < lines.length) {
    const line = lines[end];
    if (line === undefined) break;
    if (!line.trim().startsWith("|")) break;
    end++;
  }
  return { start, end };
}

function findQTableBlock(lines: readonly string[]): BlockRange | null {
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
      let end = i;
      while (end < lines.length) {
        const cur = lines[end];
        if (cur === undefined) break;
        if (!cur.trim().startsWith("|")) break;
        end++;
      }
      return { start: i, end };
    }
  }
  return null;
}

export function spliceFrontmatter(rawMd: string, newFm: Frontmatter): string {
  const lines = rawMd.split(/\r?\n/);
  const block = findFirstPipeBlock(lines);
  if (!block) {
    throw new Error("frontmatter_missing");
  }
  const before = lines.slice(0, block.start);
  const after = lines.slice(block.end);
  const renderedLines = renderFrontmatter(newFm).split("\n");
  return [...before, ...renderedLines, ...after].join("\n");
}

export function spliceQTable(rawMd: string, newRows: readonly QTableRow[]): string {
  const lines = rawMd.split(/\r?\n/);
  const block = findQTableBlock(lines);
  const rendered = renderQTable(newRows);

  if (!block) {
    if (rendered.length === 0) return rawMd;
    throw new Error("qtable_anchor_missing: cannot splice into spec without existing Q-table");
  }
  const before = lines.slice(0, block.start);
  const after = lines.slice(block.end);
  const renderedLines = rendered.length === 0 ? [] : rendered.split("\n");
  return [...before, ...renderedLines, ...after].join("\n");
}

function findPhaseBlock(lines: readonly string[], priority: Priority): BlockRange | null {
  const heading = `## ${priority}`;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (
      line.startsWith(heading) &&
      (line.length === heading.length || line[heading.length] === " ")
    ) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line === undefined) break;
    if (line.startsWith("## ")) break;
    end++;
  }
  return { start, end };
}

export function spliceTasksFile(rawMd: string, parsed: ParsedTasks): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter);
  for (const priority of PRIORITIES) {
    out = splicePhase(out, priority, parsed.phases[priority]);
  }
  return out;
}

function splicePhase(
  rawMd: string,
  priority: Priority,
  items: readonly { checked: boolean; text: string; isHumanGate: boolean }[],
): string {
  const lines = rawMd.split(/\r?\n/);
  const block = findPhaseBlock(lines, priority);
  if (!block) {
    return rawMd;
  }
  const before = lines.slice(0, block.start);
  const after = lines.slice(block.end);
  const heading = lines[block.start] ?? `## ${priority}`;
  const rendered: string[] = [heading, ""];
  for (const item of items) {
    rendered.push(renderTaskItem(item));
  }
  rendered.push("");
  return [...before, ...rendered, ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}

export function spliceSpecFile(rawMd: string, parsed: ParsedSpec): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter);
  if (parsed.qTable.length > 0 || findQTableBlock(out.split(/\r?\n/)) !== null) {
    out = spliceQTable(out, parsed.qTable);
  }
  return out;
}
