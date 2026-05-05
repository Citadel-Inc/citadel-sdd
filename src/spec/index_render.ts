import { readFileSync } from "node:fs";
import { parseSpec } from "./parse.js";
import { listSpecs, type RepoContext, type SpecLocation } from "./repo.js";

export interface IndexRow {
  slug: string;
  state: string;
  dtg: string;
  owner: string;
  note: string;
}

function buildRow(loc: SpecLocation): IndexRow | null {
  let raw: string;
  try {
    raw = readFileSync(loc.specMd, "utf8");
  } catch {
    return null;
  }
  let spec: ReturnType<typeof parseSpec>;
  try {
    spec = parseSpec(raw);
  } catch {
    return null;
  }
  const ownerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "owner");
  return {
    slug: loc.slug,
    state: spec.frontmatter.status.state,
    dtg: spec.frontmatter.status.dtg,
    owner: ownerField?.[1] ?? "",
    note: spec.frontmatter.status.tail,
  };
}

function sortDesc(a: IndexRow, b: IndexRow): number {
  return b.dtg.localeCompare(a.dtg);
}

export function buildIndex(ctx: RepoContext): {
  active: IndexRow[];
  done: IndexRow[];
  parked: IndexRow[];
} {
  const active = listSpecs(ctx, "active")
    .map(buildRow)
    .filter((r): r is IndexRow => r !== null)
    .sort(sortDesc);
  const done = listSpecs(ctx, "done")
    .map(buildRow)
    .filter((r): r is IndexRow => r !== null)
    .sort(sortDesc);
  const parked = listSpecs(ctx, "parked")
    .map(buildRow)
    .filter((r): r is IndexRow => r !== null)
    .sort(sortDesc);
  return { active, done, parked };
}

function renderActiveTable(rows: readonly IndexRow[]): string {
  const lines: string[] = [
    "## Active",
    "",
    "| Slug | State | DTG | Owner |",
    "|------|-------|-----|-------|",
  ];
  if (rows.length === 0) {
    lines.push("| _(none)_ | | | |");
  } else {
    for (const r of rows) {
      lines.push(`| ${r.slug} | ${r.state} | ${r.dtg} | ${r.owner} |`);
    }
  }
  return lines.join("\n");
}

function renderDoneTable(rows: readonly IndexRow[]): string {
  const lines: string[] = ["## Done", "", "| Slug | DTG | Note |", "|------|-----|------|"];
  if (rows.length === 0) {
    lines.push("| _(none)_ | | |");
  } else {
    for (const r of rows) {
      lines.push(`| ${r.slug} | ${r.dtg} | ${r.note} |`);
    }
  }
  return lines.join("\n");
}

function renderParkedTable(rows: readonly IndexRow[]): string {
  const lines: string[] = ["## Parked", "", "| Slug | DTG | Note |", "|------|-----|------|"];
  if (rows.length === 0) {
    lines.push("| _(none)_ | | |");
  } else {
    for (const r of rows) {
      lines.push(`| ${r.slug} | ${r.dtg} | ${r.note} |`);
    }
  }
  return lines.join("\n");
}

export function renderIndex(ctx: RepoContext): string {
  const { active, done, parked } = buildIndex(ctx);
  return `# Specs\n\n${renderActiveTable(active)}\n\n${renderDoneTable(done)}\n\n${renderParkedTable(parked)}\n`;
}
