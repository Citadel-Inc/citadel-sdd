import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { scanPriorityInNontasks, scanStrictFile } from "../lint/strict.js";
import { daysBetween, lastTouchedBulk } from "../spec/git_history.js";
import { listSpecs, type locateSpec, type RepoContext } from "../spec/repo.js";
import type { ToolContext } from "./types.js";

const FIELD_PREFIX_RE = /^[A-Za-z][A-Za-z _-]*?:\s+/;

const LINE_SPLIT_RE = /\r?\n/;

export type LintSeverity = "error" | "warning" | "info";

export interface SpecLintFinding {
  severity: LintSeverity;
  code: string;
  message: string;
  slug?: string;
  path?: string;
  root?: string;
}

export function lintFilePresence(loc: ReturnType<typeof locateSpec>): SpecLintFinding[] {
  if (!loc) {
    return [];
  }
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

export function lintStaleDays(repo: RepoContext, staleDays: number, today: Date): SpecLintFinding[] {
  const findings: SpecLintFinding[] = [];
  const map = lastTouchedBulk({
    metaRoot: repo.rootDir,
    specsRoot: join(repo.rootDir, repo.specDir),
    section: "active",
  });
  for (const loc of listSpecs(repo, "active")) {
    const last = map.get(loc.slug);
    if (last === undefined) {
      continue;
    }
    const days = daysBetween(last, today);
    if (days === null) {
      continue;
    }
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
function detectFrontmatterFormat(text: string): "pipe-table" | "inline" {
  const lines = text.split(LINE_SPLIT_RE);
  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      return "pipe-table";
    }
    if (FIELD_PREFIX_RE.test(line)) {
      return "inline";
    }
  }
  return "inline";
}

export function applyLintRules(
  findings: SpecLintFinding[],
  rules: Record<string, "error" | "warn" | "off">,
): SpecLintFinding[] {
  return findings.flatMap((f) => {
    const level = rules[f.code];
    if (level === "off") {
      return [];
    }
    if (level === "error") {
      return [{ ...f, severity: "error" as LintSeverity }];
    }
    if (level === "warn") {
      return [{ ...f, severity: "warning" as LintSeverity }];
    }
    return [f];
  });
}

export function lintStrict(
  loc: ReturnType<typeof locateSpec>,
  ctx: ToolContext,
  noStrict: boolean,
): SpecLintFinding[] {
  if (!loc || noStrict) {
    return [];
  }
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
