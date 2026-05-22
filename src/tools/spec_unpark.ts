import { readFileSync, writeFileSync } from "node:fs";
import { nowDTG } from "../spec/dtg.js";
import { gitAdd, gitCommit, gitMv } from "../spec/git.js";
import { setStatusOnSpec, setStatusOnTasks } from "../spec/mutate.js";
import { parseSpec, parseTasks } from "../spec/parse.js";
import { locateSpec, type RepoContext } from "../spec/repo.js";
import { upsertSpecReadmeRow } from "../spec/spec_readme.js";
import { assertTransitionEnabled, canTransition } from "../spec/transitions.js";
import type { SpecState } from "../spec/types.js";
import { spliceFrontmatter, spliceTasksFile } from "../spec/writer.js";
import { runSpecTxn } from "./_txn.js";
import type { ToolContext } from "./types.js";

export interface SpecUnparkInput {
  slug: string;
  resolution: string;
  commit?: boolean;
  dryRun?: boolean;
}

export interface SpecUnparkOutput {
  slug: string;
  before: { state: SpecState; dtg: string; path: string };
  after: { state: SpecState; dtg: string; path: string };
  commit_sha: string | null;
  dryRun: boolean;
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir };
}

export function specUnpark(input: SpecUnparkInput, ctx: ToolContext): SpecUnparkOutput {
  const resolution = input.resolution?.trim() ?? "";
  if (resolution.length === 0) {
    throw new Error("resolution_missing: spec_unpark requires a non-empty resolution");
  }

  const repo = repoCtx(ctx);
  const loc = locateSpec(repo, input.slug);
  if (!loc) throw new Error(`spec_not_found: ${input.slug}`);

  // Fix 4: guard — unpark only valid when spec is physically in specs/parked/.
  if (loc.state !== "parked") {
    throw new Error(
      `spec_not_parked: spec_unpark only moves specs from specs/parked/ (found in ${loc.state}/)`,
    );
  }

  const specRaw = readFileSync(loc.specMd, "utf8");
  const tasksRaw = readFileSync(loc.tasksMd, "utf8");
  const spec = parseSpec(specRaw);
  const tasks = parseTasks(tasksRaw);

  assertTransitionEnabled("spec_unpark", ctx.profile.disabled_transitions);
  const transition = canTransition(spec.frontmatter.status.state, "spec_unpark");
  if (!transition.ok) throw new Error(transition.error);

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock);
  const newStatus = {
    state: transition.to,
    dtg,
    tail: `unparked — ${resolution}`,
  };

  const updatedSpec = setStatusOnSpec(spec, newStatus);
  const updatedTasks = setStatusOnTasks(tasks, newStatus);

  const fmt = ctx.profile.frontmatter_format;
  const newSpecRaw = spliceFrontmatter(specRaw, updatedSpec.frontmatter, fmt);
  const newTasksRaw = spliceTasksFile(tasksRaw, updatedTasks, fmt);

  const beforePath = loc.relDir;
  const afterRelDir = `${repo.specDir}/active/${loc.slug}`;

  if (input.dryRun === true) {
    return {
      slug: loc.slug,
      before: {
        state: spec.frontmatter.status.state,
        dtg: spec.frontmatter.status.dtg,
        path: beforePath,
      },
      after: { state: newStatus.state, dtg: newStatus.dtg, path: afterRelDir },
      commit_sha: null,
      dryRun: true,
    };
  }

  const scopePaths = [beforePath, afterRelDir, `${repo.specDir}/README.md`];
  let commit_sha: string | null = null;

  if (input.commit !== false) {
    runSpecTxn(ctx.rootDir, { scopePaths, writeTargets: [loc.specMd, loc.tasksMd] }, () => {
      writeFileSync(loc.specMd, newSpecRaw);
      writeFileSync(loc.tasksMd, newTasksRaw);
      // loc.state is always "parked" here — ensured by fix 4 guard above.
      gitMv({ rootDir: ctx.rootDir }, beforePath, afterRelDir);
      const readmeRel = upsertSpecReadmeRow(repo, loc.slug);
      const subject =
        ctx.profile.commit_style === "conventional"
          ? `spec(${loc.slug}): UNPARK — ${resolution}`
          : `Unpark ${loc.slug}: ${resolution}`;
      gitAdd({ rootDir: ctx.rootDir }, [
        `${afterRelDir}/spec.md`,
        `${afterRelDir}/tasks.md`,
        readmeRel,
      ]);
      commit_sha = gitCommit({ rootDir: ctx.rootDir }, subject);
    });
  } else {
    writeFileSync(loc.specMd, newSpecRaw);
    writeFileSync(loc.tasksMd, newTasksRaw);
    gitMv({ rootDir: ctx.rootDir }, beforePath, afterRelDir);
    upsertSpecReadmeRow(repo, loc.slug);
  }

  return {
    slug: loc.slug,
    before: {
      state: spec.frontmatter.status.state,
      dtg: spec.frontmatter.status.dtg,
      path: beforePath,
    },
    after: { state: newStatus.state, dtg: newStatus.dtg, path: afterRelDir },
    commit_sha,
    dryRun: false,
  };
}
