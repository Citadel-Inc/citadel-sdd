import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  BUILT_IN_PROFILES,
  type Profile,
  type ProfileFragment,
  ProfileFragmentSchema,
  ProfileSchema,
} from "./types.js";

const PROFILE_DIR = dirname(fileURLToPath(import.meta.url));

export type ResolveExtra = (name: string) => Record<string, unknown> | undefined;

export interface ResolveOptions {
  resolveExtra?: ResolveExtra;
}

function loadBuiltInFragment(name: string): ProfileFragment {
  if (!BUILT_IN_PROFILES.has(name)) {
    throw new Error(`profile_unknown: "${name}"`);
  }
  // Defense-in-depth: reject names that could escape the profile directory even
  // if the BUILT_IN_PROFILES set were somehow bypassed or misused downstream.
  if (!/^[a-z][a-z0-9_-]*$/.test(name) || name.includes("..")) {
    throw new Error(`profile_unknown: invalid profile name "${name}"`);
  }
  const raw = readFileSync(join(PROFILE_DIR, `${name}.yaml`), "utf8");
  return parseFragment(raw);
}

function parseFragment(raw: string): ProfileFragment {
  const parsed = parseYaml(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("config_invalid: profile fragment must be a YAML object");
  }
  return ProfileFragmentSchema.parse(parsed);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Recursively merges child into parent for plain-object values so that a child
 * profile can partially extend nested objects (e.g. lint_rules) rather than
 * wholesale replacing them. Arrays replace wholesale — this is intentional and
 * conventional: a child that sets `states` owns the full list.
 */
function deepMerge(
  parent: Record<string, unknown>,
  child: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...parent };
  for (const [k, v] of Object.entries(child)) {
    if (v === undefined) continue;
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resolveProfile(
  fragment: Record<string, unknown> | ProfileFragment,
  opts: ResolveOptions = {},
): Profile {
  const visited = new Set<string>();
  const chain: ProfileFragment[] = [];

  let current: ProfileFragment | undefined = ProfileFragmentSchema.parse(fragment);
  let depth = 0;
  while (current !== undefined) {
    if (depth > 32) {
      throw new Error("profile_chain_broken: depth limit exceeded");
    }
    chain.push(current);
    const parentName = current.extends;
    if (parentName === undefined) break;
    if (visited.has(parentName)) {
      throw new Error(`profile_chain_broken: cycle detected at "${parentName}"`);
    }
    visited.add(parentName);
    if (BUILT_IN_PROFILES.has(parentName)) {
      current = loadBuiltInFragment(parentName);
    } else if (opts.resolveExtra) {
      const extra = opts.resolveExtra(parentName);
      if (extra === undefined) {
        throw new Error(`profile_chain_broken: unknown profile "${parentName}"`);
      }
      current = ProfileFragmentSchema.parse(extra);
    } else {
      throw new Error(`profile_chain_broken: unknown profile "${parentName}"`);
    }
    depth++;
  }

  let merged: Record<string, unknown> = {};
  for (let i = chain.length - 1; i >= 0; i--) {
    const fragmentRecord = chain[i] as Record<string, unknown>;
    merged = deepMerge(merged, fragmentRecord);
  }
  delete merged.extends;
  return ProfileSchema.parse(merged);
}

export function resolveBuiltIn(name: string): Profile {
  return resolveProfile(loadBuiltInFragment(name));
}
