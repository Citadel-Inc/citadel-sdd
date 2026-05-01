import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { resolveProfile } from "../profile/resolver.js";
import type { Profile } from "../profile/types.js";

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
    throw new Error(`config_invalid: YAML parse failed: ${(e as Error).message}`);
  }
  if (fragment === null || typeof fragment !== "object" || Array.isArray(fragment)) {
    throw new Error("config_invalid: top-level must be a YAML object");
  }
  return resolveProfile(fragment as Record<string, unknown>);
}
