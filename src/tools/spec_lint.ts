import { readFileSync } from "node:fs";
import { selectRoots } from "../discovery/roots.js";
import { CROSS_CUTTING_CATEGORIES, crossCutting } from "../lint/cross_cutting.js";
import type { StrictCategory } from "../lint/strict.js";
import { ALL_STRICT_CATEGORIES, scanPriorityInNontasks, scanStrictFile } from "../lint/strict.js";
import { checkSlugInCorrectDir, checkSpecTasksStatusAlign } from "../spec/invariants.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { listSpecs, locateSpec, type RepoContext, slugLooksValid } from "../spec/repo.js";
import type { ToolContext } from "./types.js";

export interface SpecLintInput {
  slug?: string;
  include_done?: boolean;
  no_strict?: boolean;
  fail_on?: ReadonlyArray<string> | "all";
  roots?: ReadonlyArray<string>;
  scan_nested?: { parent: string; depth?: number };
  stale_days?: number;
}

export type LintSeverity = "error" | "warning" | "info";

export interface SpecLintFinding {
  severity: LintSeverity;
  code: string;
  message: string;
  slug?: string;
  path?: string;
  root?: string;
}

export interface SpecLintOutput {
  findings: SpecLintFinding[];
  exit_code: number;
  roots?: string[];
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function lintOneRoot(repo: RepoContext, ctx: ToolContext, input: SpecLintInput): SpecLintFinding[] {
  const findings: SpecLintFinding[] = [];
  const noStrict = input.no_strict === true;

  if (input.slug !== undefined) {
    const loc = locateSpec(repo, input.slug);
    if (!loc) {
      findings.push({
        severity: "error",
        code: "spec_not_found",
        message: `spec "${input.slug}" not found in active/ or done/`,
        slug: input.slug,
      });
    } else {
      findings.push(...lintSingle(loc, ctx));
      findings.push(...lintStrict(loc, noStrict));
    }
  } else {
    const scope = input.include_done === true ? "all" : "active";
    for (const loc of listSpecs(repo, scope)) {
      findings.push(...lintSingle(loc, ctx));
      findings.push(...lintStrict(loc, noStrict));
    }
    for (const cc of crossCutting(repo)) {
      findings.push({
        severity: "warning",
        code: cc.category,
        message: cc.message,
        slug: cc.slug,
      });
    }
  }
  return findings;
}

function lintSingle(loc: ReturnType<typeof locateSpec>, ctx: ToolContext): SpecLintFinding[] {
  if (!loc) return [];
  const findings: SpecLintFinding[] = [];

  if (!slugLooksValid(loc.slug)) {
    findings.push({
      severity: "error",
      code: "slug_invalid",
      message: `slug "${loc.slug}" not kebab-case lowercase`,
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  let specMd: string;
  let tasksMd: string;
  try {
    specMd = readFileSync(loc.specMd, "utf8");
  } catch {
    findings.push({
      severity: "error",
      code: "spec_md_missing",
      message: "spec.md unreadable",
      slug: loc.slug,
      path: loc.relDir,
    });
    return findings;
  }
  try {
    tasksMd = readFileSync(loc.tasksMd, "utf8");
  } catch {
    findings.push({
      severity: "error",
      code: "tasks_md_missing",
      message: "tasks.md unreadable",
      slug: loc.slug,
      path: loc.relDir,
    });
    return findings;
  }

  let spec: ReturnType<typeof parseSpec>;
  let tasks: ReturnType<typeof parseTasks>;
  try {
    spec = parseSpec(specMd);
  } catch (e) {
    findings.push({
      severity: "warning",
      code: "spec_md_unparseable",
      message: (e as Error).message,
      slug: loc.slug,
      path: loc.relDir,
    });
    return findings;
  }
  try {
    tasks = parseTasks(tasksMd);
  } catch (e) {
    findings.push({
      severity: "warning",
      code: "tasks_md_unparseable",
      message: (e as Error).message,
      slug: loc.slug,
      path: loc.relDir,
    });
    return findings;
  }

  for (const v of checkSpecTasksStatusAlign(spec, tasks)) {
    findings.push({
      severity: "warning",
      code: v.code,
      message: v.message,
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  for (const v of checkSlugInCorrectDir(spec, loc.state)) {
    findings.push({
      severity: "warning",
      code: v.code,
      message: v.message,
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  if (
    spec.frontmatter.status.state !== "DRAFT" &&
    spec.qTable.some((r) => r.ratified.toLowerCase() === "tbd")
  ) {
    findings.push({
      severity: "warning",
      code: "qtable_unratified",
      message: "Q-table contains TBD rows after DRAFT phase",
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  if (
    ctx.profile.commit_style === "conventional" &&
    spec.frontmatter.status.state === "IN_PROGRESS" &&
    !spec.frontmatter.status.tail
  ) {
    findings.push({
      severity: "info",
      code: "status_tail_missing",
      message: "IN_PROGRESS status has no tail explanation (conventional profile)",
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  return findings;
}

function lintStrict(loc: ReturnType<typeof locateSpec>, noStrict: boolean): SpecLintFinding[] {
  if (!loc || noStrict) return [];
  const findings: SpecLintFinding[] = [];

  for (const file of [
    { name: "spec.md", abs: loc.specMd },
    { name: "plan.md", abs: loc.planMd },
    { name: "tasks.md", abs: loc.tasksMd },
  ]) {
    let text: string;
    try {
      text = readFileSync(file.abs, "utf8");
    } catch {
      continue;
    }
    for (const f of scanStrictFile(file.name, text)) {
      findings.push({
        severity: "warning",
        code: f.category,
        message: f.message,
        slug: loc.slug,
        path: loc.relDir,
      });
    }
    if (file.name !== "tasks.md") {
      for (const f of scanPriorityInNontasks(file.name, text)) {
        findings.push({
          severity: "warning",
          code: f.category,
          message: f.message,
          slug: loc.slug,
          path: loc.relDir,
        });
      }
    }
  }

  return findings;
}

function resolveFailOn(input: SpecLintInput): Set<string> | null {
  if (input.fail_on === undefined) return null;
  if (input.fail_on === "all") {
    return new Set<string>([...ALL_STRICT_CATEGORIES, ...CROSS_CUTTING_CATEGORIES, "error"]);
  }
  return new Set<string>(input.fail_on);
}

export function specLint(input: SpecLintInput, ctx: ToolContext): SpecLintOutput {
  const findings: SpecLintFinding[] = [];

  const useMultiRoot = input.roots !== undefined || input.scan_nested !== undefined;
  if (useMultiRoot) {
    const discovered = selectRoots({
      rootDir: ctx.rootDir,
      specDir: ctx.profile.spec_dir,
      roots: input.roots,
      scan_nested: input.scan_nested,
    });
    if (discovered.length === 0) {
      findings.push({
        severity: "error",
        code: "no_roots_found",
        message: "no specs/active directories matched the requested roots / scan_nested parameters",
      });
      return { findings, exit_code: 1, roots: [] };
    }
    for (const d of discovered) {
      const repo: RepoContext = { rootDir: d.metaRoot, specDir: ctx.profile.spec_dir };
      const sub = lintOneRoot(repo, ctx, input);
      for (const f of sub) findings.push({ ...f, root: d.key });
    }
    const exit = computeExit(findings, resolveFailOn(input));
    return { findings, exit_code: exit, roots: discovered.map((d) => d.key) };
  }

  const repo = repoCtx(ctx);
  findings.push(...lintOneRoot(repo, ctx, input));
  const exit = computeExit(findings, resolveFailOn(input));
  return { findings, exit_code: exit };
}

function computeExit(findings: ReadonlyArray<SpecLintFinding>, failOn: Set<string> | null): number {
  let exit_code = findings.some((f) => f.severity === "error") ? 1 : 0;
  if (failOn !== null) {
    const triggered = findings.some(
      (f) =>
        failOn.has(f.code) ||
        (failOn.has("error") && f.severity === "error") ||
        (failOn.has("warning") && f.severity === "warning"),
    );
    exit_code = triggered ? 1 : 0;
  }
  return exit_code;
}

export type { StrictCategory };
