import { readFileSync, writeFileSync } from "node:fs";
import { gitAdd, gitCommit } from "../spec/git.js";
import { setOwner } from "../spec/mutate.js";
import { parseSpec } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { upsertSpecReadmeRow } from "../spec/spec_readme.js";
import { spliceFrontmatter } from "../spec/writer.js";
import { runSpecTxn } from "./_txn.js";
import type { ToolContext } from "./types.js";

export interface SpecHandoffInput {
  slug: string;
  new_owner?: string;
  note?: string;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecHandoffOutput {
  slug: string;
  before_owner: string;
  after_owner: string;
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specHandoff(input: SpecHandoffInput, ctx: ToolContext): SpecHandoffOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const raw = readFileSync(loc.specMd, "utf8");
  const spec = parseSpec(raw);

  // Fix 2: guard — handoff only valid from IN_PROGRESS or BLOCKED.
  const currentState = spec.frontmatter.status.state;
  if (currentState !== "IN_PROGRESS" && currentState !== "BLOCKED") {
    throw new Error(
      `handoff_invalid_state: spec_handoff requires IN_PROGRESS or BLOCKED state (found ${currentState})`,
    );
  }

  const beforeOwnerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "owner");
  const before_owner = beforeOwnerField?.[1] ?? "";

  const new_owner = (() => {
    if (input.new_owner && input.new_owner.trim().length > 0) return input.new_owner.trim();
    if (ctx.profile.default_owner.length > 0) return ctx.profile.default_owner;
    throw new Error(
      "new_owner_missing: spec_handoff requires new_owner or default_owner in profile",
    );
  })();

  const updated = setOwner(spec, new_owner);
  const newRaw = spliceFrontmatter(raw, updated.frontmatter, ctx.profile.frontmatter_format);

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      before_owner,
      after_owner: new_owner,
      commit_sha: null,
      dryRun: true,
    };
  }

  const scopePaths = [`${loc.relDir}/spec.md`, `${repo.specDir}/README.md`];
  let commit_sha: string | null = null;

  if (input.commit !== false) {
    runSpecTxn(ctx.rootDir, { scopePaths, writeTargets: [loc.specMd] }, () => {
      writeFileSync(loc.specMd, newRaw);
      const readmeRel = upsertSpecReadmeRow(repo, loc.slug);
      const subject =
        ctx.profile.commit_style === "conventional"
          ? `spec(${loc.slug}): handoff to ${new_owner}${input.note ? ` — ${input.note}` : ""}`
          : `Handoff ${loc.slug} to ${new_owner}`;
      gitAdd({ rootDir: ctx.rootDir }, [`${loc.relDir}/spec.md`, readmeRel]);
      commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
    });
  } else {
    writeFileSync(loc.specMd, newRaw);
    upsertSpecReadmeRow(repo, loc.slug);
  }

  return {
    slug: loc.slug,
    before_owner,
    after_owner: new_owner,
    commit_sha,
    dryRun: false,
  };
}
