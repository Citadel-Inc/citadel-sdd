import { readFileSync, writeFileSync } from "node:fs";
import { nowDTG } from "../spec/dtg.js";
import { assertWorkingTreeClean, gitAdd, gitCommit } from "../spec/git.js";
import { type RatifyDecision, ratifySpec } from "../spec/mutate.js";
import { parseSpec } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { spliceQTable } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecRatifyInput {
  slug: string;
  decisions?: Record<string, RatifyDecision>;
  default_disposition?: string;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecRatifyOutput {
  slug: string;
  ratified_q_count: number;
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specRatify(input: SpecRatifyInput, ctx: ToolContext): SpecRatifyOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.specMd, "utf8");
  const spec = parseSpec(raw);

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const default_disposition = input.default_disposition ?? `Ratified ${dtg}`;

  const updated = ratifySpec(spec, {
    decisions: input.decisions,
    default_disposition,
    dtg,
  });

  const ratified_q_count = updated.qTable.filter(
    (r, i) => r.ratified !== spec.qTable[i]?.ratified,
  ).length;

  const newRaw = spliceQTable(raw, updated.qTable);

  if (input.dryRun === true) {
    return { slug: loc.slug, ratified_q_count, commit_sha: null, dryRun: true };
  }

  if (input.commit !== false && ratified_q_count > 0) {
    assertWorkingTreeClean({ rootDir: ctx.rootDir }, [`${loc.relDir}/spec.md`]);
  }

  writeFileSync(loc.specMd, newRaw);

  let commit_sha: string | null = null;
  if (input.commit !== false && ratified_q_count > 0) {
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): ratify ${ratified_q_count} Q-row(s)`
        : `Ratify ${ratified_q_count} Q-rows in ${loc.slug}`;
    gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/spec.md`]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return { slug: loc.slug, ratified_q_count, commit_sha, dryRun: false };
}
