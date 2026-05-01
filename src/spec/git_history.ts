import { execFileSync } from "node:child_process";

export interface GitHistoryOptions {
  metaRoot: string;
  specsRoot: string;
  section: "active" | "done";
  since?: string;
}

function runGit(metaRoot: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", metaRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
  } catch {
    return null;
  }
}

function relPath(metaRoot: string, specsRoot: string): string {
  if (specsRoot.startsWith(`${metaRoot}/`)) {
    return specsRoot.slice(metaRoot.length + 1);
  }
  if (specsRoot === metaRoot) return "";
  return specsRoot;
}

export function lastTouchedBulk(opts: GitHistoryOptions): Map<string, string> {
  const result = new Map<string, string>();
  const rel = relPath(opts.metaRoot, opts.specsRoot);
  const prefix = rel ? `${rel}/${opts.section}/` : `${opts.section}/`;
  const args = ["log", "--format=\x01%cs", "--name-only"];
  if (opts.since) args.push(`--since=${opts.since}`);
  args.push("--", prefix);
  const out = runGit(opts.metaRoot, args);
  if (out === null) return result;

  let curDate: string | null = null;
  for (const raw of out.split(/\r?\n/)) {
    if (!raw) continue;
    if (raw.startsWith("\x01")) {
      const d = raw.slice(1).trim();
      curDate = d || null;
      continue;
    }
    if (curDate === null || !raw.startsWith(prefix)) continue;
    const rest = raw.slice(prefix.length);
    const name = rest.split("/", 1)[0];
    if (name && !result.has(name)) result.set(name, curDate);
  }
  return result;
}

export interface RecentCommitsOptions extends GitHistoryOptions {
  slug: string;
  limit: number;
}

export function recentCommits(opts: RecentCommitsOptions): string[] {
  if (opts.limit <= 0) return [];
  const rel = relPath(opts.metaRoot, opts.specsRoot);
  const prefix = rel ? `${rel}/${opts.section}/${opts.slug}/` : `${opts.section}/${opts.slug}/`;
  const args = ["log", `--max-count=${opts.limit}`, "--format=%cs %h %s"];
  if (opts.since) args.push(`--since=${opts.since}`);
  args.push("--", prefix);
  const out = runGit(opts.metaRoot, args);
  if (out === null) return [];
  return out
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter((s) => s.length > 0);
}

export function daysBetween(isoDate: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number.parseInt(m[1] ?? "", 10);
  const mo = Number.parseInt(m[2] ?? "", 10);
  const d = Number.parseInt(m[3] ?? "", 10);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  const then = Date.UTC(y, mo - 1, d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((now - then) / 86_400_000);
}
