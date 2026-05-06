import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { gitAdd, gitCommit } from "../spec/git.js";
import { type RepoContext, specsRoot } from "../spec/repo.js";
import { ensureSpecBucketDirs } from "../spec/scaffold.js";
import { writeSpecReadmeFull } from "../spec/spec_readme.js";
import type { ToolContext } from "./types.js";

export interface SpecInitInput {
  profile: string;
  overrides?: Record<string, unknown>;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecInitOutput {
  created_files: string[];
  profile_resolved: string;
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function specsAlreadyPopulated(specRoot: string): boolean {
  if (!existsSync(specRoot)) return false;
  const entries = readdirSync(specRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    if (entry.isDirectory()) {
      const sub = readdirSync(join(specRoot, entry.name), { withFileTypes: true });
      const meaningful = sub.filter((e) => e.name !== ".gitkeep");
      if (meaningful.length > 0) return true;
    } else {
      return true;
    }
  }
  return false;
}

export function specInit(input: SpecInitInput, ctx: ToolContext): SpecInitOutput {
  const repo = repoCtx(ctx);
  const root = specsRoot(repo);

  if (specsAlreadyPopulated(root)) {
    throw new Error(`specs_already_populated: ${root} non-empty; refusing to overwrite`);
  }

  const config = { extends: input.profile, ...(input.overrides ?? {}) };
  const yamlText = stringifyYaml(config);

  const created_files: string[] = [];
  const configPath = join(root, "config.yaml");
  const activeKeep = join(root, "active", ".gitkeep");
  const doneKeep = join(root, "done", ".gitkeep");
  const parkedKeep = join(root, "parked", ".gitkeep");

  if (input.dryRun === true) {
    return {
      created_files: [
        `${repo.specDir}/config.yaml`,
        `${repo.specDir}/README.md`,
        `${repo.specDir}/active/.gitkeep`,
        `${repo.specDir}/done/.gitkeep`,
        `${repo.specDir}/parked/.gitkeep`,
      ],
      profile_resolved: input.profile,
      commit_sha: null,
      dryRun: true,
    };
  }

  mkdirSync(root, { recursive: true });
  ensureSpecBucketDirs(repo);
  writeFileSync(configPath, yamlText);
  created_files.push(`${repo.specDir}/config.yaml`);
  writeFileSync(activeKeep, "");
  created_files.push(`${repo.specDir}/active/.gitkeep`);
  writeFileSync(doneKeep, "");
  created_files.push(`${repo.specDir}/done/.gitkeep`);
  writeFileSync(parkedKeep, "");
  created_files.push(`${repo.specDir}/parked/.gitkeep`);
  writeSpecReadmeFull(repo);
  created_files.push(`${repo.specDir}/README.md`);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `chore(spec): init SDD scaffold (profile: ${input.profile})`
        : `Initialize SDD scaffold (profile: ${input.profile})`;
    gitAdd({ rootDir: ctx.rootDir }, created_files);
    try {
      commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
    } catch {
      commit_sha = null;
    }
  }

  return {
    created_files,
    profile_resolved: input.profile,
    commit_sha,
    dryRun: false,
  };
}
