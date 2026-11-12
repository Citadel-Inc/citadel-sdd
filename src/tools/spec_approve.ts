import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nowDTG } from '../spec/dtg.ts'
import { gitAdd, gitCommit } from '../spec/git.ts'
import { setStatusOnSpec, setStatusOnTasks } from '../spec/mutate.ts'
import { locateSpec, readSpec, readTasks, type RepoContext } from '../spec/repo.ts'
import { upsertSpecReadmeRow } from '../spec/spec_readme.ts'
import { assertTransitionEnabled, canTransition } from '../spec/transitions.ts'
import type { SpecState } from '../spec/types.ts'
import { spliceFrontmatter, spliceSpecFile } from '../spec/writer.ts'
import { assertNoSymlinks, runSpecTxn } from './_txn.ts'
import type { ToolContext } from './types.ts'

export interface SpecApproveInput {
  slug: string
  note?: string
  commit?: boolean
  dryRun?: boolean
}

export interface SpecApproveOutput {
  slug: string
  before: { state: SpecState; dtg: string }
  after: { state: SpecState; dtg: string }
  commit_sha: string | null
  dryRun: boolean
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir }
}

export function specApprove(input: SpecApproveInput, ctx: ToolContext): SpecApproveOutput {
  const repo = repoCtx(ctx)
  const loc = locateSpec(repo, input.slug)
  if (!loc) {
    throw new Error(`spec_not_found: ${input.slug}`)
  }

  const spec = readSpec(loc)
  const tasks = readTasks(loc)
  const specRaw = spec.raw
  const tasksRaw = tasks.raw

  assertTransitionEnabled('spec_approve', ctx.profile.disabled_transitions)
  const transition = canTransition(spec.frontmatter.status.state, 'spec_approve')
  if (!transition.ok) {
    throw new Error(transition.error)
  }

  const dtg = nowDTG(ctx.profile.dtg_format, ctx.clock)
  const newStatus = { state: transition.to, dtg, tail: input.note ?? '' }

  const updatedSpec = setStatusOnSpec(spec, newStatus)
  const updatedTasks = setStatusOnTasks(tasks, newStatus)

  const fmt = ctx.profile.frontmatter_format
  const newSpecRaw = spliceSpecFile(specRaw, updatedSpec, fmt)
  const newTasksRaw = spliceFrontmatter(tasksRaw, updatedTasks.frontmatter, fmt)

  const before = { state: spec.frontmatter.status.state, dtg: spec.frontmatter.status.dtg }
  const after = { state: newStatus.state, dtg: newStatus.dtg }

  if (input.dryRun === true) {
    return { slug: loc.slug, before, after, commit_sha: null, dryRun: true }
  }

  const scopePaths = [
    `${loc.relDir}/spec.md`,
    `${loc.relDir}/tasks.md`,
    `${repo.specDir}/README.md`,
  ]

  let commitSha: string | null = null
  const writeTargets = [loc.specMd, loc.tasksMd, join(ctx.rootDir, repo.specDir, 'README.md')]

  if (input.commit === false) {
    assertNoSymlinks(writeTargets)
    writeFileSync(loc.specMd, newSpecRaw)
    writeFileSync(loc.tasksMd, newTasksRaw)
    upsertSpecReadmeRow(repo, loc.slug)
  } else {
    runSpecTxn(ctx.rootDir, { scopePaths, writeTargets }, () => {
      writeFileSync(loc.specMd, newSpecRaw)
      writeFileSync(loc.tasksMd, newTasksRaw)
      const readmeRel = upsertSpecReadmeRow(repo, loc.slug)
      const conventional = ctx.profile.commit_style === 'conventional'
      const base = conventional ? `spec(${loc.slug}): APPROVED` : `Approve ${loc.slug}`
      const noteSep = conventional ? ' — ' : ': '
      const subject = input.note ? `${base}${noteSep}${input.note}` : base
      gitAdd({ rootDir: ctx.rootDir }, [
        `${loc.relDir}/spec.md`,
        `${loc.relDir}/tasks.md`,
        readmeRel,
      ])
      commitSha = gitCommit({ rootDir: ctx.rootDir }, subject)
    })
  }

  return { slug: loc.slug, before, after, commit_sha: commitSha, dryRun: false }
}
