import { readFileSync, writeFileSync } from "node:fs";
import { nowDTG } from "../spec/dtg.js";
import { assertWorkingTreeClean, gitAdd, gitCommit, gitConfigUserName } from "../spec/git.js";
import { ratifySpec, setStatusOnSpec, setStatusOnTasks } from "../spec/mutate.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { upsertSpecReadmeRow } from "../spec/spec_readme.js";
import { assertTransitionEnabled, canTransition } from "../spec/transitions.js";
import type { SpecState } from "../spec/types.js";
import { spliceFrontmatter, spliceQTable, spliceSpecFile } from "../spec/writer.js";
import type { ToolContext } from "./types.js";

export interface SpecClaimInput {
  slug: string;
  claimer?: string;
  ratify?: boolean;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecClaimOutput {
  slug: string;
  before: { state: SpecState; dtg: string };
  after: { state: SpecState; dtg: string };
  ratified_q_count: number;
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

function defaultClaimer(ctx: ToolContext): string {
  if (ctx.profile.default_claimer.length > 0) return ctx.profile.default_claimer;
  const fromGit = gitConfigUserName({ rootDir: ctx.rootDir });
  if (fromGit.length > 0) return fromGit;
  return "Bastion";
}

export function specClaim(input: SpecClaimInput, ctx: ToolContext): SpecClaimOutput {
  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  const specRaw = readFileSync(loc.specMd, "utf8");
  const tasksRaw = readFileSync(loc.tasksMd, "utf8");
  const spec = parseSpec(specRaw);
  const tasks = parseTasks(tasksRaw);

  const claimer = input.claimer ?? defaultClaimer(ctx);

  const ownerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === "owner");
  const author = ownerField?.[1] ?? "";

  if (spec.frontmatter.status.state === "IN_PROGRESS" && author.length > 0 && author !== claimer) {
    throw new Error(`owner_mismatch: held by ${author}; claimer ${claimer}`);
  }

  assertTransitionEnabled("spec_claim", ctx.profile.disabled_transitions);
  const transition = canTransition(spec.frontmatter.status.state, "spec_claim", {
    claimerIsAuthor: author === claimer,
  });
  if (!transition.ok) throw new Error(transition.error);

  const ratifyEnabled = input.ratify ?? true;
  const hasTbd = spec.qTable.some((r) => r.ratified.toLowerCase() === "tbd");
  if (!ratifyEnabled && hasTbd) {
    throw new Error("ratify_required: Q-table has TBD rows; pass ratify:true to bulk-ratify");
  }

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const newStatus = {
    state: transition.to,
    dtg,
    tail: `${claimer} claims execution`,
  };

  const ratifyOpts = {
    decisions: undefined,
    default_disposition: `Ratified ${dtg}`,
    dtg,
  };
  const updatedSpec = ratifyEnabled
    ? setStatusOnSpec(ratifySpec(spec, ratifyOpts), newStatus)
    : setStatusOnSpec(spec, newStatus);
  const updatedTasks = setStatusOnTasks(tasks, newStatus);

  const ratifiedCount = ratifyEnabled
    ? spec.qTable.filter((r) => r.ratified.toLowerCase() === "tbd").length
    : 0;

  const fmt = ctx.profile.frontmatter_format;
  let newSpecRaw = spliceFrontmatter(specRaw, updatedSpec.frontmatter, fmt);
  if (ratifyEnabled && spec.qTable.length > 0) {
    newSpecRaw = spliceQTable(newSpecRaw, updatedSpec.qTable);
  } else {
    newSpecRaw = spliceSpecFile(specRaw, updatedSpec, fmt);
  }
  const newTasksRaw = spliceFrontmatter(tasksRaw, updatedTasks.frontmatter, fmt);

  const before = { state: spec.frontmatter.status.state, dtg: spec.frontmatter.status.dtg };
  const after = { state: newStatus.state, dtg: newStatus.dtg };

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      before,
      after,
      ratified_q_count: ratifiedCount,
      commit_sha: null,
      dryRun: true,
    };
  }

  if (input.commit !== false) {
    assertWorkingTreeClean({ rootDir: ctx.rootDir }, [
      `${loc.relDir}/spec.md`,
      `${loc.relDir}/tasks.md`,
      `${repo.specDir}/README.md`,
    ]);
  }

  writeFileSync(loc.specMd, newSpecRaw);
  writeFileSync(loc.tasksMd, newTasksRaw);

  const readmeRel = upsertSpecReadmeRow(repo, loc.slug);

  let commit_sha: string | null = null;
  if (input.commit !== false) {
    const ratifyTail = ratifiedCount > 0 ? `; ratified ${ratifiedCount} Q-row(s)` : "";
    const subject =
      ctx.profile.commit_style === "conventional"
        ? `spec(${loc.slug}): IN_PROGRESS — ${claimer} claims${ratifyTail}`
        : `${claimer} claims ${loc.slug}${ratifyTail}`;
    gitAdd({ rootDir: ctx.rootDir }, [
      `${loc.relDir}/spec.md`,
      `${loc.relDir}/tasks.md`,
      readmeRel,
    ]);
    commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
  }

  return {
    slug: loc.slug,
    before,
    after,
    ratified_q_count: ratifiedCount,
    commit_sha,
    dryRun: false,
  };
}
