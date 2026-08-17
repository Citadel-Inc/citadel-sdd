import { selectRoots } from "../discovery/roots.js";
import { CROSS_CUTTING_CATEGORIES, crossCutting } from "../lint/cross_cutting.js";
import { ALL_STRICT_CATEGORIES } from "../lint/strict.js";
import { listSpecs, locateSpec, type RepoContext, type SpecLifecycleState } from "../spec/repo.js";
import {
  lintFilePresence,
  lintStaleDays,
  lintStrict,
  type SpecLintFinding,
} from "./spec_lint_rules.js";
import { lintSingle } from "./spec_lint_single.js";
import type { ToolContext } from "./types.js";

export type { LintSeverity, SpecLintFinding } from "./spec_lint_rules.js";

export interface SpecLintInput {
  slug?: string;
  include_done?: boolean;
  /** When true, include `specs/parked/` in repo-wide scans (no slug). */
  include_parked?: boolean;
  no_strict?: boolean;
  fail_on?: readonly string[] | "all";
  roots?: readonly string[];
  scan_nested?: { parent: string; depth?: number };
  stale_days?: number;
}

export interface SpecLintOutput {
  findings: SpecLintFinding[];
  exit_code: number;
  roots?: string[];
}

function treeScanDirs(input: SpecLintInput): SpecLifecycleState[] {
  const dirs: SpecLifecycleState[] = ["active"];
  if (input.include_done === true) {
    dirs.push("done");
  }
  if (input.include_parked === true) {
    dirs.push("parked");
  }
  return dirs;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function lintOneRoot(repo: RepoContext, ctx: ToolContext, input: SpecLintInput): SpecLintFinding[] {
  const findings: SpecLintFinding[] = [];
  const noStrict = input.no_strict === true;

  if (input.slug === undefined) {
    for (const section of treeScanDirs(input)) {
      for (const loc of listSpecs(repo, section)) {
        if (loc.state === "active" || loc.state === "parked") {
          findings.push(...lintFilePresence(loc));
        }
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
  } else {
    const loc = locateSpec(repo, input.slug);
    if (loc) {
      if (loc.state === "active" || loc.state === "parked") {
        findings.push(...lintFilePresence(loc));
      }
      findings.push(...lintSingle(loc, ctx));
      findings.push(...lintStrict(loc, ctx, noStrict));
    } else {
      findings.push({
        severity: "error",
        code: "spec_not_found",
        message: `spec "${input.slug}" not found in active/, done/, or parked/`,
        slug: input.slug,
      });
    }
  }
  return findings;
}

function resolveFailOn(input: SpecLintInput): Set<string> | null {
  if (input.fail_on === undefined) {
    return null;
  }
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
      for (const f of sub) {
        findings.push({ ...f, root: d.key });
      }
    }
    const exit = computeExit(findings, resolveFailOn(input));
    return { findings, exit_code: exit, roots: discovered.map((d) => d.key) };
  }

  const repo = repoCtx(ctx);
  findings.push(...lintOneRoot(repo, ctx, input));
  const exit = computeExit(findings, resolveFailOn(input));
  return { findings, exit_code: exit };
}

function computeExit(findings: readonly SpecLintFinding[], failOn: Set<string> | null): number {
  let exitCode = findings.some((f) => f.severity === "error") ? 1 : 0;
  if (failOn !== null) {
    const triggered = findings.some(
      (f) =>
        failOn.has(f.code) ||
        (failOn.has("error") && f.severity === "error") ||
        (failOn.has("warning") && f.severity === "warning"),
    );
    exitCode = triggered ? 1 : 0;
  }
  return exitCode;
}

export type { StrictCategory } from "../lint/strict.js";
