import { execFileSync } from "node:child_process";

export interface GitContext {
  rootDir: string;
}

export interface DirtyResult {
  dirty: boolean;
  files: string[];
}

function git(ctx: GitContext, args: readonly string[], opts: { silent?: boolean } = {}): string {
  return execFileSync("git", ["-C", ctx.rootDir, ...args], {
    encoding: "utf8",
    stdio: opts.silent ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
  });
}

export function gitStatusPorcelain(ctx: GitContext): string[] {
  const out = git(ctx, ["status", "--porcelain"], { silent: true });
  return out.split("\n").filter((l) => l.length > 0);
}

export function gitWorkingTreeDirty(
  ctx: GitContext,
  ignorePaths: readonly string[] = [],
): DirtyResult {
  const lines = gitStatusPorcelain(ctx);
  const files = lines
    .map((l) => l.slice(3))
    .filter((p) => !ignorePaths.some((ig) => p === ig || p.startsWith(`${ig}/`)));
  return { dirty: files.length > 0, files };
}

export function gitAdd(ctx: GitContext, files: readonly string[]): void {
  if (files.length === 0) return;
  git(ctx, ["add", "--", ...files], { silent: true });
}

export function gitCommit(ctx: GitContext, message: string): string {
  git(ctx, ["commit", "-m", message], { silent: true });
  return git(ctx, ["rev-parse", "HEAD"], { silent: true }).trim();
}

export function gitPush(ctx: GitContext): void {
  git(ctx, ["push"], { silent: true });
}

export function gitMv(ctx: GitContext, from: string, to: string): void {
  git(ctx, ["mv", from, to], { silent: true });
}

export function gitRevParseShowToplevel(cwd: string): string {
  return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
}

export function gitConfigUserName(ctx: GitContext): string {
  try {
    return git(ctx, ["config", "user.name"], { silent: true }).trim();
  } catch {
    return "";
  }
}

export function gitConfigUserEmail(ctx: GitContext): string {
  try {
    return git(ctx, ["config", "user.email"], { silent: true }).trim();
  } catch {
    return "";
  }
}

export function gitInit(rootDir: string): void {
  execFileSync("git", ["-C", rootDir, "init", "--initial-branch=main"], { stdio: "ignore" });
}

export function gitConfigSet(ctx: GitContext, key: string, value: string): void {
  git(ctx, ["config", key, value], { silent: true });
}
