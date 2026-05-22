import type { FrontmatterFormat } from "../profile/types.js";
import {
  renderFrontmatter,
  renderFrontmatterInline,
  renderQTable,
  renderTaskItem,
} from "./render.js";
import type { Frontmatter, ParsedSpec, ParsedTasks, Priority, QTableRow } from "./types.js";
import { PRIORITIES } from "./types.js";

interface BlockRange {
  start: number;
  end: number;
}

function insertAfterTitle(lines: readonly string[], block: string): string {
  // Locate insertion point: after any leading blanks + the title line + its trailing blanks.
  let i = 0;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  if (i < lines.length) i++; // advance past title line
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  return [...lines.slice(0, i), ...block.split("\n"), "", ...lines.slice(i)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
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
      /proposed\s*default/i.test(line)
    ) {
      // Require the very next line to be a markdown table separator row,
      // so we don't mistake prose tables for Q-tables.
      const nextRaw = lines[i + 1];
      if (nextRaw === undefined || !isSeparatorRow(nextRaw.trim())) continue;
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

function isSeparatorRow(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line);
}

export function spliceFrontmatter(
  rawMd: string,
  newFm: Frontmatter,
  format: FrontmatterFormat = "any",
): string {
  const lines = rawMd.split(/\r?\n/);
  const block = findFirstPipeBlock(lines);
  const hasPipe = block !== null;

  const targetPipe = format === "pipe-table" || (format === "any" && hasPipe);

  if (targetPipe) {
    if (hasPipe && block) {
      // Replace existing pipe block.
      const before = lines.slice(0, block.start);
      const after = lines.slice(block.end);
      return [...before, ...renderFrontmatter(newFm).split("\n"), ...after].join("\n");
    }
    // Convert inline → pipe-table (or insert into file with no frontmatter): strip inline keys, insert pipe block after title.
    const fieldKeys = new Set(["status", ...newFm.fields.map(([k]) => k.toLowerCase())]);
    const RE_INLINE = /^([A-Za-z][A-Za-z _-]*?):\s+/;
    const stripped = lines.filter((line) => {
      const m = RE_INLINE.exec(line);
      return !(m && fieldKeys.has((m[1] ?? "").trim().toLowerCase()));
    });
    return insertAfterTitle(stripped, renderFrontmatter(newFm));
  }

  // Target is inline (format === "inline" or format === "any" without pipe block).
  if (hasPipe && block) {
    // Convert pipe-table → inline: replace pipe block with key-value lines.
    const before = lines.slice(0, block.start);
    const after = lines.slice(block.end);
    return [...before, ...renderFrontmatterInline(newFm).split("\n"), ...after].join("\n");
  }
  // Inline frontmatter: replace each matching "Key: value" line in-place.
  const fieldMap = new Map(newFm.fields.map(([k, v]) => [k.toLowerCase(), { key: k, value: v }]));
  let found = false;
  const newLines = lines.map((line) => {
    const m = /^([A-Za-z][A-Za-z _-]*?):\s+/.exec(line);
    if (!m) return line;
    const keyLower = (m[1] ?? "").trim().toLowerCase();
    const entry = fieldMap.get(keyLower);
    if (!entry) return line;
    found = true;
    return `${entry.key}: ${entry.value}`;
  });
  if (!found) {
    // No existing frontmatter — insert after title using the canonical format for this mode.
    const rendered =
      format === "inline" ? renderFrontmatterInline(newFm) : renderFrontmatter(newFm);
    return insertAfterTitle(lines, rendered);
  }
  return newLines.join("\n");
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

export function spliceTasksFile(
  rawMd: string,
  parsed: ParsedTasks,
  format: FrontmatterFormat = "any",
): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter, format);
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

export function spliceSpecFile(
  rawMd: string,
  parsed: ParsedSpec,
  format: FrontmatterFormat = "any",
): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter, format);
  if (parsed.qTable.length > 0 || findQTableBlock(out.split(/\r?\n/)) !== null) {
    out = spliceQTable(out, parsed.qTable);
  }
  return out;
}
