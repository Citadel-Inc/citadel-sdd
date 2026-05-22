import { readFileSync } from "node:fs";
import { CITADEL_SDD_REPO_URL } from "./constants.js";
import { dtgToRecencySortKey } from "./dtg.js";
import { parseSpec } from "./parse.js";
import { listSpecs, type RepoContext, type SpecLocation } from "./repo.js";

export interface IndexRow {
  slug: string;
  state: string;
  dtg: string;
  owner: string;
  note: string;
}

export const SPEC_README_ACTIVE_HEADER = "| Slug | State | DTG | Owner |";
export const SPEC_README_DONE_OR_PARKED_HEADER = "| Slug | DTG | Note |";

export const SPEC_README_ACTIVE_PLACEHOLDER = "| _(none)_ | | | |";
export const SPEC_README_DONE_OR_PARKED_PLACEHOLDER = "| _(none)_ | | |";

export function formatActiveIndexRow(r: IndexRow): string {
  return `| ${r.slug} | ${r.state} | ${r.dtg} | ${r.owner} |`;
}

export function formatDoneOrParkedIndexRow(r: IndexRow): string {
  return `| ${r.slug} | ${r.dtg} | ${r.note} |`;
}

export function buildRow(loc: SpecLocation): IndexRow {
  let raw: string;
  try {
    raw = readFileSync(loc.specMd, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { slug: loc.slug, state: "ERROR", dtg: "", owner: "", note: msg };
  }
  let spec: ReturnType<typeof parseSpec>;
  try {
    spec = parseSpec(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { slug: loc.slug, state: "ERROR", dtg: "", owner: "", note: msg };
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

/** Newest (largest recency key) first; tie-break by slug for stable diffs. */
function sortByRecencyDesc(a: IndexRow, b: IndexRow): number {
  const kb = dtgToRecencySortKey(b.dtg);
  const ka = dtgToRecencySortKey(a.dtg);
  if (kb !== ka) return kb - ka;
  return a.slug.localeCompare(b.slug);
}

export function buildIndex(ctx: RepoContext): {
  active: IndexRow[];
  done: IndexRow[];
  parked: IndexRow[];
} {
  const active = listSpecs(ctx, "active").map(buildRow).sort(sortByRecencyDesc);
  const done = listSpecs(ctx, "done").map(buildRow).sort(sortByRecencyDesc);
  const parked = listSpecs(ctx, "parked").map(buildRow).sort(sortByRecencyDesc);
  return { active, done, parked };
}

function introActive(): string {
  return `*In-flight specifications (DRAFT through BLOCKED) under \`specs/active/\`. Claim, block, unblock, park, and close via [\`@rethunk/citadel-sdd\`](${CITADEL_SDD_REPO_URL}).*`;
}

function introDone(): string {
  return `*Completed work (**DONE**) after \`spec_close\`; directories live under \`specs/done/\`. Lifecycle semantics and tools: [\`@rethunk/citadel-sdd\`](${CITADEL_SDD_REPO_URL}).*`;
}

function introParked(): string {
  return `*Deliberately not pursued (**PARKED**); superseded or withdrawn specs under \`specs/parked/\`. Use \`spec_park\` from [\`@rethunk/citadel-sdd\`](${CITADEL_SDD_REPO_URL}).*`;
}

function renderActiveTable(rows: readonly IndexRow[]): string {
  const lines: string[] = [
    "## Active",
    "",
    introActive(),
    "",
    SPEC_README_ACTIVE_HEADER,
    "|------|-------|-----|-------|",
  ];
  if (rows.length === 0) {
    lines.push(SPEC_README_ACTIVE_PLACEHOLDER);
  } else {
    for (const r of rows) {
      lines.push(formatActiveIndexRow(r));
    }
  }
  return lines.join("\n");
}

function renderDoneTable(rows: readonly IndexRow[]): string {
  const lines: string[] = [
    "## Done",
    "",
    introDone(),
    "",
    SPEC_README_DONE_OR_PARKED_HEADER,
    "|------|-----|------|",
  ];
  if (rows.length === 0) {
    lines.push(SPEC_README_DONE_OR_PARKED_PLACEHOLDER);
  } else {
    for (const r of rows) {
      lines.push(formatDoneOrParkedIndexRow(r));
    }
  }
  return lines.join("\n");
}

function renderParkedTable(rows: readonly IndexRow[]): string {
  const lines: string[] = [
    "## Parked",
    "",
    introParked(),
    "",
    SPEC_README_DONE_OR_PARKED_HEADER,
    "|------|-----|------|",
  ];
  if (rows.length === 0) {
    lines.push(SPEC_README_DONE_OR_PARKED_PLACEHOLDER);
  } else {
    for (const r of rows) {
      lines.push(formatDoneOrParkedIndexRow(r));
    }
  }
  return lines.join("\n");
}

export function renderIndex(ctx: RepoContext): string {
  const { active, done, parked } = buildIndex(ctx);
  return `# Specs\n\n${renderActiveTable(active)}\n\n${renderDoneTable(done)}\n\n${renderParkedTable(parked)}\n`;
}
