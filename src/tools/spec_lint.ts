import { readFileSync } from "node:fs";
import { checkSlugInCorrectDir, checkSpecTasksStatusAlign } from "../spec/invariants.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { listSpecs, locateSpec, type RepoContext, slugLooksValid } from "../spec/repo.js";
import type { ToolContext } from "./types.js";

export interface SpecLintInput {
  slug?: string;
  include_done?: boolean;
}

export type LintSeverity = "error" | "warning" | "info";

export interface SpecLintFinding {
  severity: LintSeverity;
  code: string;
  message: string;
  slug?: string;
  path?: string;
}

export interface SpecLintOutput {
  findings: SpecLintFinding[];
  exit_code: number;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
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
      severity: "error",
      code: v.code,
      message: v.message,
      slug: loc.slug,
      path: loc.relDir,
    });
  }

  for (const v of checkSlugInCorrectDir(spec, loc.state)) {
    findings.push({
      severity: "error",
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

export function specLint(input: SpecLintInput, ctx: ToolContext): SpecLintOutput {
  const repo = repoCtx(ctx);
  const findings: SpecLintFinding[] = [];

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
    }
  } else {
    const scope = input.include_done === true ? "all" : "active";
    for (const loc of listSpecs(repo, scope)) {
      findings.push(...lintSingle(loc, ctx));
    }
  }

  const exit_code = findings.some((f) => f.severity === "error") ? 1 : 0;
  return { findings, exit_code };
}
