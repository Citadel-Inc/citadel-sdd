import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { resolveProfile } from "../profile/resolver.js";
import type { Profile } from "../profile/types.js";
import { resolveRepoSubdir } from "../spec/repo.js";

export interface LoadOptions {
  rootDir: string;
}

export function loadConfig(opts: LoadOptions): Profile {
  const path = join(opts.rootDir, "specs", "config.yaml");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`config_missing: ${path}`);
  }
  let fragment: unknown;
  try {
    fragment = parseYaml(raw);
  } catch (e) {
    // The YAML parser message can embed raw source-line content; extract just
    // the first line (the human-readable summary) to keep the error concise.
    const yamlMsg = (e as Error).message.split("\n")[0] ?? "YAML parse error";
    throw new Error(`config_invalid: ${path}: ${yamlMsg}`);
  }
  if (fragment === null || typeof fragment !== "object" || Array.isArray(fragment)) {
    throw new Error(`config_invalid: ${path}: top-level must be a YAML object`);
  }
  let profile: Profile;
  try {
    profile = resolveProfile(fragment as Record<string, unknown>);
  } catch (e) {
    // Zod and profile errors can be verbose; surface only the first line so
    // the client sees a single actionable message, not a full stack dump.
    const detail = (e as Error).message.split("\n")[0] ?? "invalid profile";
    throw new Error(`config_invalid: ${path}: ${detail}`);
  }
  try {
    resolveRepoSubdir(opts.rootDir, profile.spec_dir);
  } catch (e) {
    throw new Error(`config_invalid: ${path}: ${(e as Error).message}`);
  }
  return profile;
}
