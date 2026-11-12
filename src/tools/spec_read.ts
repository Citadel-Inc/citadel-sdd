import { existsSync } from 'node:fs'
import { locateSpec, readPlan, readSpec, readTasks, type RepoContext } from '../spec/repo.ts'
import type { ToolContext } from './types.ts'

export type SpecReadPart = 'spec' | 'plan' | 'tasks'

export interface SpecReadInput {
  slug: string
  parts?: SpecReadPart[]
}

export interface SpecReadOutput {
  slug: string
  state: 'active' | 'done' | 'parked'
  spec_md: string | null
  plan_md: string | null
  tasks_md: string | null
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir }
}

export function specRead(input: SpecReadInput, ctx: ToolContext): SpecReadOutput {
  const loc = locateSpec(repoCtx(ctx), input.slug)
  if (!loc) {
    throw new Error(`spec_not_found: ${input.slug}`)
  }
  const parts = new Set<SpecReadPart>(input.parts ?? ['spec', 'plan', 'tasks'])

  let planMd: string | null = null
  if (parts.has('plan')) {
    if (!existsSync(loc.planMd)) {
      throw new Error(`file_not_found: plan.md missing for spec ${loc.slug} at ${loc.planMd}`)
    }
    planMd = readPlan(loc)
  }

  let tasksMd: string | null = null
  if (parts.has('tasks')) {
    if (!existsSync(loc.tasksMd)) {
      throw new Error(`file_not_found: tasks.md missing for spec ${loc.slug} at ${loc.tasksMd}`)
    }
    tasksMd = readTasks(loc).raw
  }

  return {
    slug: loc.slug,
    state: loc.state,
    spec_md: parts.has('spec') ? readSpec(loc).raw : null,
    plan_md: planMd,
    tasks_md: tasksMd,
  }
}
