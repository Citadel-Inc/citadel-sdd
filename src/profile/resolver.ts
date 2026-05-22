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
  // `visited` tracks every profile name that has appeared anywhere in the
  // resolution chain, including the root fragment's own identity (if it declares
  // `extends`, the target is added before we load it).  This catches:
  //   - self-extension:  extends: "self"  (caught on the first lookup)
  //   - two-step cycles: A → B → A       (caught when B tries to load A again)
  //   - any longer cycle without relying on the depth fallback
  const visited = new Set<string>();
  const chain: ProfileFragment[] = [];

  let current: ProfileFragment | undefined = ProfileFragmentSchema.parse(fragment);
  // Seed visited with the root fragment's own extends target so that if the
  // root itself is later loaded by name and extends back here, we detect it.
  if (current.extends !== undefined) {
    visited.add(current.extends);
  }

  while (chain.length <= 64) {
    chain.push(current);
    const parentName = current.extends;
    if (parentName === undefined) break;

    let next: ProfileFragment;
    if (BUILT_IN_PROFILES.has(parentName)) {
      next = loadBuiltInFragment(parentName);
    } else if (opts.resolveExtra) {
      const extra = opts.resolveExtra(parentName);
      if (extra === undefined) {
        throw new Error(`profile_chain_broken: unknown profile "${parentName}"`);
      }
      next = ProfileFragmentSchema.parse(extra);
    } else {
      throw new Error(`profile_chain_broken: unknown profile "${parentName}"`);
    }

    // After loading the next fragment, check whether its own `extends` target
    // is already in the resolution chain before we continue.
    const nextParent = next.extends;
    if (nextParent !== undefined) {
      if (visited.has(nextParent)) {
        throw new Error(
          `profile_cycle: profile "${nextParent}" appears more than once in the extends chain`,
        );
      }
      visited.add(nextParent);
    }

    current = next;
  }

  if (chain.length > 64) {
    throw new Error("profile_chain_broken: depth limit exceeded");
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
