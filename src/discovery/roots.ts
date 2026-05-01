import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

export interface DiscoveredRoot {
  metaRoot: string;
  specsRoot: string;
  key: string;
}

const NOISE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".venv",
  "venv",
  "target",
  ".yarn",
  ".cache",
]);

export function rootKey(specsRoot: string): string {
  const meta = isAbsolute(specsRoot) ? specsRoot : resolve(specsRoot);
  const parent = meta.replace(/\/specs\/?$/, "");
  return basename(parent) || parent;
}

function asDiscovered(metaRoot: string, specsRoot: string): DiscoveredRoot {
  return { metaRoot, specsRoot, key: rootKey(specsRoot) };
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

export function findSingleRoot(start: string, specDir = "specs"): DiscoveredRoot | null {
  let cur = resolve(start);
  for (;;) {
    const candidate = join(cur, specDir, "active");
    if (isDir(candidate)) {
      return asDiscovered(cur, join(cur, specDir));
    }
    const parent = resolve(cur, "..");
    if (parent === cur) return null;
    cur = parent;
  }
}

export function resolveRoots(paths: ReadonlyArray<string>, specDir = "specs"): DiscoveredRoot[] {
  const out: DiscoveredRoot[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const p = resolve(trimmed);
    const meta = basename(p) === specDir ? resolve(p, "..") : p;
    const specs = join(meta, specDir);
    if (!isDir(join(specs, "active"))) continue;
    if (seen.has(specs)) continue;
    seen.add(specs);
    out.push(asDiscovered(meta, specs));
  }
  return out;
}

export interface ScanNestedOptions {
  parent: string;
  depth?: number;
  specDir?: string;
}

export function scanNested(opts: ScanNestedOptions): DiscoveredRoot[] {
  const parent = resolve(opts.parent);
  const depth = opts.depth ?? 3;
  const specDir = opts.specDir ?? "specs";
  if (!isDir(parent)) return [];
  const found = new Map<string, DiscoveredRoot>();

  const walk = (p: string, remaining: number): void => {
    if (remaining < 0) return;
    let entries: string[];
    try {
      entries = readdirSync(p);
    } catch {
      return;
    }
    const candidate = join(p, specDir, "active");
    if (isDir(candidate) && !isSymlink(candidate)) {
      const meta = p;
      const specs = join(meta, specDir);
      if (!found.has(specs)) {
        found.set(specs, asDiscovered(meta, specs));
      }
    }
    if (remaining === 0) return;
    for (const name of entries) {
      if (NOISE_DIRS.has(name)) continue;
      const full = join(p, name);
      if (isSymlink(full)) continue;
      if (!isDir(full)) continue;
      walk(full, remaining - 1);
    }
  };

  walk(parent, depth);
  return [...found.values()].sort((a, b) => a.specsRoot.localeCompare(b.specsRoot));
}

export function selectRoots(input: {
  rootDir: string;
  specDir: string;
  roots?: ReadonlyArray<string>;
  scan_nested?: { parent: string; depth?: number };
}): DiscoveredRoot[] {
  if (input.scan_nested) {
    return scanNested({
      parent: input.scan_nested.parent,
      depth: input.scan_nested.depth,
      specDir: input.specDir,
    });
  }
  if (input.roots && input.roots.length > 0) {
    return resolveRoots(input.roots, input.specDir);
  }
  if (existsSync(join(input.rootDir, input.specDir, "active"))) {
    const meta = input.rootDir;
    const specs = join(meta, input.specDir);
    return [asDiscovered(meta, specs)];
  }
  return [];
}
