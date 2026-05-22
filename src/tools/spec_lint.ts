import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { selectRoots } from "../discovery/roots.js";
import { CROSS_CUTTING_CATEGORIES, crossCutting } from "../lint/cross_cutting.js";
import type { StrictCategory } from "../lint/strict.js";
import { ALL_STRICT_CATEGORIES, scanPriorityInNontasks, scanStrictFile } from "../lint/strict.js";
import { daysBetween, lastTouchedBulk } from "../spec/git_history.js";
import { checkSlugInCorrectDir, checkSpecTasksStatusAlign } from "../spec/invariants.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import {
  listSpecs,
  locateSpec,
  type RepoContext,
  type SpecLifecycleState,
  slugLooksValid,
} from "../spec/repo.js";
import type { ToolContext } from "./types.js";

export interface SpecLintInput {
  slug?: string;
  include_done?: boolean;
  /** When true, include `specs/parked/` in repo-wide scans (no slug). */
  include_parked?: boolean;
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

function treeScanDirs(input: SpecLintInput): SpecLifecycleState[] {
  const dirs: SpecLifecycleState[] = ["active"];
  if (input.include_done === true) dirs.push("done");
  if (input.include_parked === true) dirs.push("parked");
  return dirs;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function lintFilePresence(loc: ReturnType<typeof locateSpec>): SpecLintFinding[] {
  if (!loc) return [];
  const findings: SpecLintFinding[] = [];
  const checks: ReadonlyArray<{ code: string; abs: string; msg: string }> = [
    { code: "missing-tasks", abs: loc.tasksMd, msg: `${loc.slug}: missing tasks.md` },
    { code: "missing-spec", abs: loc.specMd, msg: `${loc.slug}: missing spec.md` },
    { code: "missing-plan", abs: loc.planMd, msg: `${loc.slug}: missing plan.md` },
  ];
  for (const c of checks) {
    if (!existsSync(c.abs)) {
      findings.push({
        severity: "warning",
        code: c.code,
        message: c.msg,
        slug: loc.slug,
        path: loc.relDir,
      });
    }
  }
  for (const name of ["progress.md", "PROGRESS.md"]) {
    if (existsSync(join(loc.dir, name))) {
      findings.push({
        severity: "warning",
        code: "progress-file",
        message: `${loc.slug}: ${name} present (delete before commit)`,
        slug: loc.slug,
        path: loc.relDir,
      });
      break;
    }
  }
  return findings;
}

function lintStaleDays(repo: RepoContext, staleDays: number, today: Date): SpecLintFinding[] {
  const findings: SpecLintFinding[] = [];
  const map = lastTouchedBulk({
    metaRoot: repo.rootDir,
    specsRoot: join(repo.rootDir, repo.specDir),
    section: "active",
  });
  for (const loc of listSpecs(repo, "active")) {
    const last = map.get(loc.slug);
    if (last === undefined) continue;
    const days = daysBetween(last, today);
    if (days === null) continue;
    if (days >= staleDays) {
      findings.push({
        severity: "warning",
        code: "stale",
        message: `${loc.slug}: stale — last touched ${last} (${days}d ago, threshold ${staleDays}d)`,
        slug: loc.slug,
        path: loc.relDir,
      });
    }
  }
  return findings;
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
        message: `spec "${input.slug}" not found in active/, done/, or parked/`,
        slug: input.slug,
      });
    } else {
      if (loc.state === "active" || loc.state === "parked") findings.push(...lintFilePresence(loc));
      findings.push(...lintSingle(loc, ctx));
      findings.push(...lintStrict(loc, ctx, noStrict));
    }
  } else {
    for (const section of treeScanDirs(input)) {
      for (const loc of listSpecs(repo, section)) {
        if (loc.state === "active" || loc.state === "parked")
          findings.push(...lintFilePresence(loc));
        findings.push(...lintSingle(loc, ctx));
        findings.push(...lintStrict(loc, ctx, noStrict));
      }
    }
    for (const cc of crossCutting(repo)) {
      findings.push({
        severity: "warning",
        code: cc.category,
        message: cc.message,
        slug: cc.slug,
      });
    }
    const effectiveStaleDays = input.stale_days ?? ctx.profile.stale_days;
    if (effectiveStaleDays !== undefined && effectiveStaleDays >= 0) {
      const today = ctx.clock ? ctx.clock() : new Date();
      findings.push(...lintStaleDays(repo, effectiveStaleDays, today));
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
      severity: "error",
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
      severity: "error",
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
    spec.frontmatter.status.state !== "PARKED" &&
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

function detectFrontmatterFormat(text: string): "pipe-table" | "inline" {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().startsWith("|")) return "pipe-table";
    if (/^[A-Za-z][A-Za-z _-]*?:\s+/.test(line)) return "inline";
  }
  return "inline";
}

function applyLintRules(
  findings: SpecLintFinding[],
  rules: Record<string, "error" | "warn" | "off">,
): SpecLintFinding[] {
  return findings.flatMap((f) => {
    const level = rules[f.code];
    if (level === "off") return [];
    if (level === "error") return [{ ...f, severity: "error" as LintSeverity }];
    if (level === "warn") return [{ ...f, severity: "warning" as LintSeverity }];
    return [f];
  });
}

function lintStrict(
  loc: ReturnType<typeof locateSpec>,
  ctx: ToolContext,
  noStrict: boolean,
): SpecLintFinding[] {
  if (!loc || noStrict) return [];
  const findings: SpecLintFinding[] = [];
  const fmtEnforcement = ctx.profile.frontmatter_format;

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
    if (fmtEnforcement !== "any") {
      const actual = detectFrontmatterFormat(text);
      if (actual !== fmtEnforcement) {
        findings.push({
          severity: "warning",
          code: "strict-frontmatter-format",
          message: `${file.name}:1: frontmatter is ${actual} but profile enforces ${fmtEnforcement}`,
          slug: loc.slug,
          path: loc.relDir,
        });
      }
    }
  }

  return applyLintRules(findings, ctx.profile.lint_rules);
}

function resolveFailOn(input: SpecLintInput): Set<string> | null {
  if (input.fail_on === undefined) return null;
  if (input.fail_on === "all") {
    return new Set<string>([
      ...ALL_STRICT_CATEGORIES,
      ...CROSS_CUTTING_CATEGORIES,
      "stale",
      "missing-tasks",
      "missing-spec",
      "missing-plan",
      "progress-file",
      "error",
    ]);
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
