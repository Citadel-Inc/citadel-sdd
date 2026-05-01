import { renderFrontmatter, renderFrontmatterInline, renderQTable, renderTaskItem } from "./render.js";
import type { Frontmatter, ParsedSpec, ParsedTasks, Priority, QTableRow } from "./types.js";
import { PRIORITIES } from "./types.js";
import type { FrontmatterFormat } from "../profile/types.js";

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
    // Convert inline → pipe-table: strip matching key-value lines, prepend pipe block.
    const fieldKeys = new Set([
      "status",
      ...newFm.fields.map(([k]) => k.toLowerCase()),
    ]);
    const RE_INLINE = /^([A-Za-z][A-Za-z _-]*?):\s+/;
    const stripped = lines.filter((line) => {
      const m = RE_INLINE.exec(line);
      return !(m && fieldKeys.has((m[1] ?? "").trim().toLowerCase()));
    });
    return [...renderFrontmatter(newFm).split("\n"), ...stripped].join("\n");
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
    throw new Error("frontmatter_missing");
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
