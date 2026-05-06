import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRow,
  formatActiveIndexRow,
  formatDoneOrParkedIndexRow,
  type IndexRow,
  renderIndex,
  SPEC_README_ACTIVE_HEADER,
  SPEC_README_ACTIVE_PLACEHOLDER,
  SPEC_README_DONE_OR_PARKED_HEADER,
  SPEC_README_DONE_OR_PARKED_PLACEHOLDER,
} from "./index_render.js";
import { locateSpec, type RepoContext, type SpecLifecycleState } from "./repo.js";

export const README_UNPARSEABLE = "readme_unparseable";

function readmeAbsPath(repo: RepoContext): string {
  return join(repo.rootDir, repo.specDir, "README.md");
}

/** Repo-relative path for `git add`. */
export function specReadmeRelPath(repo: RepoContext): string {
  return `${repo.specDir}/README.md`;
}

/** Full regeneration — only `spec_init` and `spec_index_rebuild` may call this. */
export function writeSpecReadmeFull(repo: RepoContext): string {
  const p = readmeAbsPath(repo);
  writeFileSync(p, renderIndex(repo), "utf8");
  return specReadmeRelPath(repo);
}

function firstTableCell(line: string): string {
  const parts = line.split("|");
  return (parts[1] ?? "").trim();
}

function isSeparatorLine(line: string): boolean {
  return /^\|\s*-+/.test(line.trim());
}

interface ParsedSection {
  /** Index of `## Active` / `## Done` / `## Parked`. */
  start: number;
  /** First line of data rows (after separator). */
  dataStart: number;
  /** First line after the last data row in this section. */
  dataEndExclusive: number;
  /** Index of the next section heading, or `lines.length`. */
  nextSectionStart: number;
}

function parseSectionTable(
  lines: string[],
  sectionHeading: "## Active" | "## Done" | "## Parked",
  nextHeading: "## Done" | "## Parked" | null,
  machineHeader: string,
): ParsedSection {
  const start = lines.findIndex((l) => l.trim() === sectionHeading);
  if (start < 0) {
    throw new Error(`${README_UNPARSEABLE}: missing ${sectionHeading}; run spec_index_rebuild`);
  }

  const nextSectionStart = nextHeading
    ? lines.findIndex((l, i) => i > start && l.trim() === nextHeading)
    : lines.length;
  if (nextHeading && nextSectionStart < 0) {
    throw new Error(`${README_UNPARSEABLE}: missing ${nextHeading}; run spec_index_rebuild`);
  }

  let headerIdx = -1;
  for (let i = start + 1; i < nextSectionStart; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const t = line.trim();
    if (/^##\s/.test(t)) {
      throw new Error(
        `${README_UNPARSEABLE}: unexpected heading before ${sectionHeading} table header; run spec_index_rebuild`,
      );
    }
    if (t === machineHeader) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error(
      `${README_UNPARSEABLE}: missing ${sectionHeading} table header; run spec_index_rebuild`,
    );
  }

  const sepLine = lines[headerIdx + 1];
  if (sepLine === undefined || !isSeparatorLine(sepLine)) {
    throw new Error(
      `${README_UNPARSEABLE}: missing or invalid separator after ${sectionHeading} header; run spec_index_rebuild`,
    );
  }

  const dataStart = headerIdx + 2;
  let j = dataStart;
  while (j < nextSectionStart) {
    const line = lines[j];
    if (line === undefined) break;
    if (/^##\s/.test(line.trim())) break;
    const t = line.trimStart();
    if (!t.startsWith("|")) break;
    j++;
  }

  return { start, dataStart, dataEndExclusive: j, nextSectionStart };
}

function placeholderFor(bucket: SpecLifecycleState): string {
  return bucket === "active"
    ? SPEC_README_ACTIVE_PLACEHOLDER
    : SPEC_README_DONE_OR_PARKED_PLACEHOLDER;
}

function formatRowForBucket(bucket: SpecLifecycleState, row: IndexRow): string {
  return bucket === "active" ? formatActiveIndexRow(row) : formatDoneOrParkedIndexRow(row);
}

function extractDataLines(lines: string[], p: ParsedSection): string[] {
  return lines.slice(p.dataStart, p.dataEndExclusive);
}

/**
 * Targeted index update: remove `slug` from all three tables, ensure placeholders for
 * empty tables, then insert the fresh row at the top of the destination table only.
 */
export function upsertSpecReadmeRow(repo: RepoContext, slug: string): string {
  const loc = locateSpec(repo, slug);
  if (!loc) throw new Error(`spec_not_found: ${slug}`);
  const row = buildRow(loc);
  if (!row) {
    throw new Error(
      `${README_UNPARSEABLE}: cannot read spec.md for ${slug}; run spec_index_rebuild`,
    );
  }

  const path = readmeAbsPath(repo);
  if (!existsSync(path)) {
    throw new Error(
      `${README_UNPARSEABLE}: ${repo.specDir}/README.md missing; run spec_init or spec_index_rebuild`,
    );
  }

  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);

  const pa = parseSectionTable(lines, "## Active", "## Done", SPEC_README_ACTIVE_HEADER);
  const pd = parseSectionTable(lines, "## Done", "## Parked", SPEC_README_DONE_OR_PARKED_HEADER);
  const pp = parseSectionTable(lines, "## Parked", null, SPEC_README_DONE_OR_PARKED_HEADER);

  const dest = loc.state;

  const nextData: Record<SpecLifecycleState, string[]> = {
    active: extractDataLines(lines, pa).filter((ln) => firstTableCell(ln) !== slug),
    done: extractDataLines(lines, pd).filter((ln) => firstTableCell(ln) !== slug),
    parked: extractDataLines(lines, pp).filter((ln) => firstTableCell(ln) !== slug),
  };

  for (const b of ["active", "done", "parked"] as const) {
    if (nextData[b].length === 0) {
      nextData[b] = [placeholderFor(b)];
    }
  }

  const destLines = nextData[dest].filter((ln) => firstTableCell(ln) !== "_(none)_");
  nextData[dest] = [formatRowForBucket(dest, row), ...destLines];

  const tailNewline = raw.endsWith("\n") ? "\n" : "";
  const out =
    [
      ...lines.slice(0, pa.start),
      ...lines.slice(pa.start, pa.dataStart),
      ...nextData.active,
      ...lines.slice(pa.dataEndExclusive, pd.start),
      ...lines.slice(pd.start, pd.dataStart),
      ...nextData.done,
      ...lines.slice(pd.dataEndExclusive, pp.start),
      ...lines.slice(pp.start, pp.dataStart),
      ...nextData.parked,
      ...lines.slice(pp.dataEndExclusive, lines.length),
    ].join("\n") + tailNewline;

  writeFileSync(path, out, "utf8");
  return specReadmeRelPath(repo);
}
