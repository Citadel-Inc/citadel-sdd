import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTasks } from '../spec/parse.ts'
import { listSpecs, type RepoContext, type SpecLocation, specsRoot } from '../spec/repo.ts'
import { BLOCKER_CATEGORIES, blockerLint, parseBlockers } from './blockers.ts'

const ACTIVE_HEADING_RE = /^##\s+Active\b/i
const DONE_HEADING_RE = /^##\s+Done\b/i
const PARKED_HEADING_RE = /^##\s+Parked\b/i
const H2_RE = /^##\s+/
const SLUG_ROW_RE = /^\|\s*([a-z0-9][a-z0-9-]*)\s*\|/

const LINE_SPLIT_RE = /\r?\n/

export interface CrossCuttingFinding {
  category: string
  message: string
  slug?: string
}

interface SpecSummary {
  loc: SpecLocation
  open: number
  done: number
  human: number
}

function summarize(loc: SpecLocation): SpecSummary | null {
  let raw: string
  try {
    raw = readFileSync(loc.tasksMd, 'utf8')
  } catch {
    return null
  }
  let parsed: ReturnType<typeof parseTasks>
  try {
    parsed = parseTasks(raw)
  } catch {
    return null
  }
  const all = [...parsed.phases.P0, ...parsed.phases.P1, ...parsed.phases.P2]
  const open = all.filter((t) => !t.checked).length
  const done = all.filter((t) => t.checked).length
  const human = all.filter((t) => t.isHumanGate && !t.checked).length
  return { loc, open, done, human }
}

function readIndex(
  rootDir: string,
  specDir: string,
): {
  active: Set<string>
  done: Set<string>
  parked: Set<string>
} {
  const path = join(rootDir, specDir, 'README.md')
  const out = { active: new Set<string>(), done: new Set<string>(), parked: new Set<string>() }
  if (!existsSync(path)) {
    return out
  }
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return out
  }
  const lines = text.split(LINE_SPLIT_RE)
  let section: 'active' | 'done' | 'parked' | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (ACTIVE_HEADING_RE.test(line)) {
      section = 'active'
      continue
    }
    if (DONE_HEADING_RE.test(line)) {
      section = 'done'
      continue
    }
    if (PARKED_HEADING_RE.test(line)) {
      section = 'parked'
      continue
    }
    if (H2_RE.test(line)) {
      section = null
      continue
    }
    if (section === null) {
      continue
    }
    const m: RegExpExecArray | null = SLUG_ROW_RE.exec(line)
    if (m?.[1]) {
      out[section].add(m[1])
    }
  }
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readBlockersText(rootDir: string): string | null {
  const path = join(rootDir, 'HUMAN_BLOCKERS.md')
  if (!existsSync(path)) {
    return null
  }
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function readyToCloseFindings(summaries: readonly SpecSummary[]): CrossCuttingFinding[] {
  return summaries
    .filter((s) => s.open === 0 && s.done > 0 && s.human === 0)
    .map((s) => ({
      category: 'ready-to-close',
      slug: s.loc.slug,
      message: `${s.loc.slug}: ready to close (open=0, human=0) — move to specs/done/`,
    }))
}

function indexParityFindings(
  disk: ReadonlySet<string>,
  indexed: ReadonlySet<string>,
  missing: { category: string; message: (slug: string) => string },
  extra: { category: string; message: (slug: string) => string },
  skipMissingWhenIndexEmpty: boolean,
): CrossCuttingFinding[] {
  const findings: CrossCuttingFinding[] = []
  for (const slug of disk) {
    if (skipMissingWhenIndexEmpty && indexed.size === 0) {
      continue
    }
    if (!indexed.has(slug)) {
      findings.push({ category: missing.category, slug, message: missing.message(slug) })
    }
  }
  for (const slug of indexed) {
    if (!disk.has(slug)) {
      findings.push({ category: extra.category, slug, message: extra.message(slug) })
    }
  }
  return findings
}

function humanUncrossedFindings(
  summaries: readonly SpecSummary[],
  blockersText: string,
): CrossCuttingFinding[] {
  const findings: CrossCuttingFinding[] = []
  for (const s of summaries) {
    // Word-boundary so a slug that is a prefix of another ("api" vs "api-v2")
    // is not treated as a reference to the shorter spec.
    const slugRe = new RegExp(`(?<![a-z0-9-])${escapeRegex(s.loc.slug)}(?![a-z0-9-])`)
    if (s.human > 0 && !slugRe.test(blockersText)) {
      findings.push({
        category: 'human-uncrossed',
        slug: s.loc.slug,
        message: `${s.loc.slug}: ${s.human} HUMAN task(s) in tasks.md but spec name not referenced in HUMAN_BLOCKERS.md`,
      })
    }
  }
  return findings
}

export function crossCutting(repo: RepoContext): CrossCuttingFinding[] {
  const findings: CrossCuttingFinding[] = []
  specsRoot(repo)

  const active = listSpecs(repo, 'active')
  const done = listSpecs(repo, 'done')
  const parked = listSpecs(repo, 'parked')
  const activeSummaries = active.map(summarize).filter((s): s is SpecSummary => s !== null)
  findings.push(...readyToCloseFindings(activeSummaries))

  const index = readIndex(repo.rootDir, repo.specDir)
  const activeNames = new Set(active.map((l) => l.slug))
  const doneNames = new Set(done.map((l) => l.slug))
  const parkedNames = new Set(parked.map((l) => l.slug))

  const runIndexParity =
    activeNames.size > 0 ||
    doneNames.size > 0 ||
    parkedNames.size > 0 ||
    index.active.size > 0 ||
    index.done.size > 0 ||
    index.parked.size > 0

  if (runIndexParity) {
    findings.push(
      ...indexParityFindings(
        activeNames,
        index.active,
        {
          category: 'not-indexed',
          message: (slug) =>
            `${slug}: in specs/active/ but missing from specs/README.md Active table`,
        },
        {
          category: 'orphan-indexed',
          message: (slug) => `${slug}: listed in specs/README.md Active but not in specs/active/`,
        },
        false,
      ),
      ...indexParityFindings(
        doneNames,
        index.done,
        {
          category: 'orphan-done',
          message: (slug) => `${slug}: in specs/done/ but missing from specs/README.md Done table`,
        },
        {
          category: 'orphan-done',
          message: (slug) => `${slug}: listed in specs/README.md Done but not in specs/done/`,
        },
        true,
      ),
      ...indexParityFindings(
        parkedNames,
        index.parked,
        {
          category: 'orphan-parked',
          message: (slug) =>
            `${slug}: in specs/parked/ but missing from specs/README.md Parked table`,
        },
        {
          category: 'orphan-parked',
          message: (slug) => `${slug}: listed in specs/README.md Parked but not in specs/parked/`,
        },
        false,
      ),
    )
  }

  const blockersText = readBlockersText(repo.rootDir)
  if (blockersText !== null) {
    findings.push(...humanUncrossedFindings(activeSummaries, blockersText))
  }

  const blockers = parseBlockers(repo.rootDir)
  if (blockers !== null) {
    const activeSlugs = new Set(active.map((l) => l.slug))
    const activeSlugsWithOpenHuman = new Set(
      activeSummaries.filter((s) => s.human > 0).map((s) => s.loc.slug),
    )
    const allKnownSlugs = new Set([
      ...active.map((l) => l.slug),
      ...done.map((l) => l.slug),
      ...parked.map((l) => l.slug),
    ])
    for (const f of blockerLint(blockers, {
      activeSlugs,
      activeSlugsWithOpenHuman,
      allKnownSlugs,
    })) {
      findings.push({ category: f.category, message: f.message })
    }
  }

  return findings
}

export const CROSS_CUTTING_CATEGORIES: readonly string[] = [
  'ready-to-close',
  'not-indexed',
  'orphan-indexed',
  'orphan-done',
  'orphan-parked',
  'human-uncrossed',
  ...BLOCKER_CATEGORIES,
]
