import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoContext } from "./repo.js";
import { specsRoot } from "./repo.js";

const BUCKETS = ["active", "done", "parked"] as const;

/**
 * Ensures `specs/<active|done|parked>/` exist under the repo context.
 * When a bucket directory is **newly** created, adds `.gitkeep` so git tracks the empty path.
 * No-op when the specs root directory does not exist yet.
 *
 * @returns Repo-relative paths created (bucket path when newly created; `.gitkeep` when added).
 */
export function ensureSpecBucketDirs(ctx: RepoContext): string[] {
  const root = specsRoot(ctx);
  if (!existsSync(root)) return [];

  const created: string[] = [];
  const specDirPosix = ctx.specDir.replace(/\\/g, "/");

  for (const bucket of BUCKETS) {
    const dir = join(root, bucket);
    const hadDir = existsSync(dir);
    mkdirSync(dir, { recursive: true });
    const relDir = `${specDirPosix}/${bucket}`;
    if (!hadDir) {
      created.push(relDir);
      const gitkeepPath = join(dir, ".gitkeep");
      writeFileSync(gitkeepPath, "");
      created.push(`${relDir}/.gitkeep`);
    }
  }

  return created;
}
