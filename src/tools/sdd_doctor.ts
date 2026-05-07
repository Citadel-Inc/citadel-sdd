import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { listSpecs, type RepoContext, specsRoot } from "../spec/repo.js";
import { ensureSpecBucketDirs } from "../spec/scaffold.js";
import type { SpecLintFinding } from "./spec_lint.js";
import { specLint } from "./spec_lint.js";
import type { ToolContext } from "./types.js";

export type SddDoctorInput = Record<string, unknown>;

export interface SddDoctorOutput {
  inferred_profile: string;
  findings: SpecLintFinding[];
  drift: boolean;
  recommendations: string[];
  /** Repo-relative paths created while repairing the active/done/parked bucket layout (empty if nothing changed). */
  scaffold_repairs: string[];
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function inferProfile(rootDir: string, specDir: string): string {
  const path = join(rootDir, specDir, "config.yaml");
  if (!existsSync(path)) return "unknown";
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object" && typeof parsed.extends === "string") {
      return parsed.extends;
    }
  } catch {
    return "unknown";
  }
  return "default";
}

export function sddDoctor(_input: SddDoctorInput, ctx: ToolContext): SddDoctorOutput {
  const repo = repoCtx(ctx);
  const inferred = inferProfile(repo.rootDir, repo.specDir);

  let scaffold_repairs: string[] = [];
  if (existsSync(specsRoot(repo))) {
    scaffold_repairs = ensureSpecBucketDirs(repo);
  }

  const lint = specLint({ include_done: true, include_parked: true }, ctx);

  const recommendations: string[] = [];
  const specsCount = listSpecs(repo, "all").length;
  if (specsCount === 0) {
    recommendations.push("Repo has no specs yet. Run spec_init to bootstrap.");
  }

  const configPath = join(repo.rootDir, repo.specDir, "config.yaml");
  if (!existsSync(configPath)) {
    recommendations.push(`No ${repo.specDir}/config.yaml found. Run spec_init.`);
  }

  if (lint.findings.some((f) => f.code === "status_drift")) {
    recommendations.push("status_drift detected; verify spec.md and tasks.md status fields agree.");
  }

  if (lint.findings.some((f) => f.code === "path_mismatch")) {
    recommendations.push(
      "path_mismatch detected; specs in wrong directory for their state. Check active/ vs done/ vs parked/.",
    );
  }

  if (scaffold_repairs.length > 0) {
    recommendations.push(
      `Repaired missing spec bucket paths: ${scaffold_repairs.join(", ")}. Commit if you want them tracked.`,
    );
  }

  return {
    inferred_profile: inferred,
    findings: lint.findings,
    drift: lint.findings.some(
      (f) => f.severity === "error" || f.code === "status_drift" || f.code === "path_mismatch",
    ),
    recommendations,
    scaffold_repairs,
  };
}
