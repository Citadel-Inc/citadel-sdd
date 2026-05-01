import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { listSpecs, type RepoContext } from "../spec/repo.js";
import type { SpecLintFinding } from "./spec_lint.js";
import { specLint } from "./spec_lint.js";
import type { ToolContext } from "./types.js";

export type SddDoctorInput = Record<string, never>;

export interface SddDoctorOutput {
  inferred_profile: string;
  findings: SpecLintFinding[];
  drift: boolean;
  recommendations: string[];
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

  const lint = specLint({ include_done: true }, ctx);

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
      "path_mismatch detected; specs in wrong directory for their state. Check active/ vs done/.",
    );
  }

  return {
    inferred_profile: inferred,
    findings: lint.findings,
    drift: lint.findings.some(
      (f) => f.severity === "error" || f.code === "status_drift" || f.code === "path_mismatch",
    ),
    recommendations,
  };
}
