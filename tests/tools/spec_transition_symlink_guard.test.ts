/**
 * Regression: `commit: false` must not bypass the symlink guard. A committed
 * symlinked `tasks.md` / `spec.md` is refused before any write reaches the link
 * target, leaving the out-of-repo file byte-identical.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specBlock } from '../../src/tools/spec_block.ts'
import { specHandoff } from '../../src/tools/spec_handoff.ts'
import { specTaskAdd } from '../../src/tools/spec_task_add.ts'
import { specTaskCheck } from '../../src/tools/spec_task_check.ts'
import { specUnblock } from '../../src/tools/spec_unblock.ts'
import { specUnpark } from '../../src/tools/spec_unpark.ts'
import type { ToolContext } from '../../src/tools/types.ts'
import { makeTempRepo, type TempRepo } from '../helpers/temp-repo.ts'

let temp: TempRepo | undefined
let victimDirs: string[] = []

afterEach(() => {
  temp?.cleanup()
  temp = undefined
  for (const d of victimDirs) {
    rmSync(d, { recursive: true, force: true })
  }
  victimDirs = []
})

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0))

function ctx(): ToolContext {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  return { rootDir: temp.rootDir, profile: resolveBuiltIn('bastion'), clock: CLOCK }
}

/**
 * Replace a repo file with a committed symlink to an out-of-repo victim holding a copy
 * of the original content (so parsing succeeds and the write is actually reached).
 */
function commitSymlink(relPath: string): string {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  const abs = join(temp.rootDir, relPath)
  const original = readFileSync(abs, 'utf8')
  const victimDir = mkdtempSync(join(tmpdir(), 'citadel-sdd-victim-'))
  victimDirs.push(victimDir)
  const victim = join(victimDir, 'victim.md')
  writeFileSync(victim, original)
  rmSync(abs, { force: true })
  symlinkSync(victim, abs)
  const rootDir = temp.rootDir
  const git = (args: readonly string[]): void => {
    execFileSync('git', ['-C', rootDir, ...args], { stdio: 'ignore' })
  }
  git(['add', relPath])
  git(['commit', '-m', `symlink ${relPath}`])
  return victim
}

describe('commit:false refuses symlinked spec files', () => {
  test('spec_block refuses a symlinked tasks.md', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const victim = commitSymlink('specs/active/in-progress-midway/tasks.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specBlock(
        { slug: 'in-progress-midway', reason: 'vendor lib unreleased', commit: false },
        ctx(),
      ),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_unblock refuses a symlinked spec.md', () => {
    temp = makeTempRepo({ activeFixtures: ['blocked-reason'] })
    const victim = commitSymlink('specs/active/blocked-reason/spec.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specUnblock(
        { slug: 'blocked-reason', resolution: 'dependency shipped', commit: false },
        ctx(),
      ),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_unpark refuses a symlinked tasks.md', () => {
    temp = makeTempRepo({ parkedFixtures: ['parked-minimal'] })
    const victim = commitSymlink('specs/parked/parked-minimal/tasks.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specUnpark({ slug: 'parked-minimal', resolution: 'revived', commit: false }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_handoff refuses a symlinked spec.md', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const victim = commitSymlink('specs/active/in-progress-midway/spec.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specHandoff({ slug: 'in-progress-midway', new_owner: 'Someone', commit: false }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_task_check refuses a symlinked tasks.md', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const victim = commitSymlink('specs/active/draft-minimal/tasks.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specTaskCheck(
        { slug: 'draft-minimal', items: [{ phase: 'P0', match: 2, checked: true }], commit: false },
        ctx(),
      ),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_task_add refuses a symlinked tasks.md', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const victim = commitSymlink('specs/active/draft-minimal/tasks.md')
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specTaskAdd({ slug: 'draft-minimal', phase: 'P2', text: 'later', commit: false }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })
})
