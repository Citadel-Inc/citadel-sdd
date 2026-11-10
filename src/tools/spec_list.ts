import { readFileSync } from 'node:fs'
import { dtgToRecencySortKey } from '../spec/dtg.ts'
import { parseSpec, parseTasks } from '../spec/parse.ts'
import { listSpecs, type RepoContext, type SpecLocation } from '../spec/repo.ts'
import type { SpecState } from '../spec/types.ts'
import type { ToolContext } from './types.ts'

export interface SpecListInput {
  state?: 'active' | 'done' | 'parked' | 'blocked' | 'all'
  mine?: boolean
  slim?: boolean
  limit?: number
  offset?: number
}

export interface SpecListEntry {
  slug: string
  state: SpecState
  dtg: string
  owner: string
  approved_dtg: string | null
  ratified: boolean
  p0_remaining: number
  p1_remaining: number
  p2_remaining: number
  blockers: string[]
  tasks: { checked: number; total: number }
}

export interface SpecListSlimEntry {
  slug: string
  state: SpecState
  dtg: string
  owner: string
  p0: number
  p1: number
  p2: number
  tasks: { checked: number; total: number }
}

function repoCtx(ctx: ToolContext): RepoContext {
  return { rootDir: ctx.rootDir, specDir: ctx.profile.spec_dir }
}

function remainingOpen(tasks: ReturnType<typeof parseTasks>, priority: 'P0' | 'P1' | 'P2'): number {
  return tasks.phases[priority].filter((t) => !t.checked).length
}

function taskTotals(tasks: ReturnType<typeof parseTasks>): { checked: number; total: number } {
  let checked = 0
  let total = 0
  for (const p of ['P0', 'P1', 'P2'] as const) {
    total += tasks.phases[p].length
    checked += tasks.phases[p].filter((t) => t.checked).length
  }
  return { checked, total }
}

function specListEntry(opts: {
  loc: SpecLocation
  specMd: string
  tasksMd: string
  requested: NonNullable<SpecListInput['state']>
  mine: boolean
  principal: string | undefined
}): SpecListEntry | null {
  let spec: ReturnType<typeof parseSpec>
  let tasks: ReturnType<typeof parseTasks>
  try {
    spec = parseSpec(opts.specMd)
    tasks = parseTasks(opts.tasksMd)
  } catch {
    return null
  }

  if (opts.requested === 'blocked' && spec.frontmatter.status.state !== 'BLOCKED') {
    return null
  }

  const ownerField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === 'owner')
  const owner = ownerField?.[1] ?? ''
  if (opts.mine && opts.principal !== undefined && owner !== opts.principal) {
    return null
  }

  const approvedField = spec.frontmatter.fields.find(([k]) => k.toLowerCase() === 'approved')
  const approvedDtg = approvedField?.[1] && approvedField[1] !== 'TBD' ? approvedField[1] : null

  return {
    slug: opts.loc.slug,
    state: spec.frontmatter.status.state,
    dtg: spec.frontmatter.status.dtg,
    owner,
    approved_dtg: approvedDtg,
    ratified:
      spec.qTable.length > 0 && spec.qTable.every((r) => r.ratified.toLowerCase() !== 'tbd'),
    p0_remaining: remainingOpen(tasks, 'P0'),
    p1_remaining: remainingOpen(tasks, 'P1'),
    p2_remaining: remainingOpen(tasks, 'P2'),
    blockers: [],
    tasks: taskTotals(tasks),
  }
}

function sortSpecListEntries(entries: SpecListEntry[], mine: boolean): void {
  if (mine) {
    entries.sort(
      (a, b) =>
        a.p0_remaining +
        a.p1_remaining +
        a.p2_remaining -
        (b.p0_remaining + b.p1_remaining + b.p2_remaining),
    )
    return
  }
  // Chronological recency, same key as specs/README.md — Bastion stamps are
  // not lexicographic (011200ZJUN26 sorts before 311200ZMAY26 as strings).
  entries.sort((a, b) => {
    const kb = dtgToRecencySortKey(b.dtg)
    const ka = dtgToRecencySortKey(a.dtg)
    if (kb !== ka) {
      return kb - ka
    }
    return a.slug.localeCompare(b.slug)
  })
}

export function specList(
  input: SpecListInput & { slim: true },
  ctx: ToolContext,
): SpecListSlimEntry[]
export function specList(
  input: SpecListInput & { slim?: false | undefined },
  ctx: ToolContext,
): SpecListEntry[]
export function specList(
  input: SpecListInput,
  ctx: ToolContext,
): SpecListEntry[] | SpecListSlimEntry[]
export function specList(
  input: SpecListInput,
  ctx: ToolContext,
): SpecListEntry[] | SpecListSlimEntry[] {
  const requested = input.state ?? 'active'
  const dirScope: 'active' | 'done' | 'parked' | 'all' =
    requested === 'blocked' || requested === 'all' ? 'all' : requested
  const locations = listSpecs(repoCtx(ctx), dirScope)
  const entries: SpecListEntry[] = []
  const mine = input.mine === true

  for (const loc of locations) {
    let specMd = ''
    let tasksMd = ''
    try {
      specMd = readFileSync(loc.specMd, 'utf8')
      tasksMd = readFileSync(loc.tasksMd, 'utf8')
    } catch {
      continue
    }
    const entry = specListEntry({
      loc,
      specMd,
      tasksMd,
      requested,
      mine,
      principal: ctx.principal,
    })
    if (entry) {
      entries.push(entry)
    }
  }

  sortSpecListEntries(entries, mine)

  const offset = Math.max(0, input.offset ?? 0)
  const limit = input.limit !== undefined && input.limit >= 0 ? input.limit : undefined
  const sliced = limit === undefined ? entries.slice(offset) : entries.slice(offset, offset + limit)

  if (input.slim === true) {
    return sliced.map(
      (e): SpecListSlimEntry => ({
        slug: e.slug,
        state: e.state,
        dtg: e.dtg,
        owner: e.owner,
        p0: e.p0_remaining,
        p1: e.p1_remaining,
        p2: e.p2_remaining,
        tasks: e.tasks,
      }),
    )
  }

  return sliced
}
