/**
 * Regression: `specs/README.md` is a write target of every index writer. A committed
 * symlink there must be refused instead of being written through to an outside file.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specBlock } from '../../src/tools/spec_block.ts'
import { specHandoff } from '../../src/tools/spec_handoff.ts'
import { specIndexRebuild } from '../../src/tools/spec_index_rebuild.ts'
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

function head(): string {
  return execFileSync('git', ['-C', temp?.rootDir ?? '', 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
}

/** Replace `specs/README.md` with a committed symlink to an out-of-repo copy. */
function commitReadmeSymlink(): string {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  const abs = join(temp.rootDir, 'specs', 'README.md')
  const victimDir = mkdtempSync(join(tmpdir(), 'citadel-sdd-victim-'))
  victimDirs.push(victimDir)
  const victim = join(victimDir, 'victim.md')
  writeFileSync(victim, readFileSync(abs, 'utf8'))
  rmSync(abs, { force: true })
  symlinkSync(victim, abs)
  const rootDir = temp.rootDir
  const git = (args: readonly string[]): void => {
    execFileSync('git', ['-C', rootDir, ...args], { stdio: 'ignore' })
  }
  git(['add', 'specs/README.md'])
  git(['commit', '-m', 'symlink specs/README.md'])
  return victim
}

describe('a symlinked specs/README.md is refused', () => {
  test('spec_index_rebuild refuses it with commit:false', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')

    expect(() => specIndexRebuild({ commit: false }, ctx())).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_index_rebuild refuses it with commit:true', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')

    expect(() => specIndexRebuild({}, ctx())).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_unblock refuses it and commits nothing', () => {
    temp = makeTempRepo({ activeFixtures: ['blocked-reason'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')
    const headBefore = head()

    expect(() =>
      specUnblock({ slug: 'blocked-reason', resolution: 'dependency shipped' }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
    expect(head()).toBe(headBefore)
  })

  test('spec_block refuses it with commit:false', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specBlock({ slug: 'in-progress-midway', reason: 'waiting', commit: false }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_unpark refuses it with commit:false', () => {
    temp = makeTempRepo({ parkedFixtures: ['parked-minimal'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')

    expect(() =>
      specUnpark({ slug: 'parked-minimal', resolution: 'revived', commit: false }, ctx()),
    ).toThrow(/symlink/)
    expect(readFileSync(victim, 'utf8')).toBe(before)
  })

  test('spec_handoff refuses it and commits nothing', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const victim = commitReadmeSymlink()
    const before = readFileSync(victim, 'utf8')
    const headBefore = head()

    expect(() => specHandoff({ slug: 'in-progress-midway', new_owner: 'Someone' }, ctx())).toThrow(
      /symlink/,
    )
    expect(readFileSync(victim, 'utf8')).toBe(before)
    expect(head()).toBe(headBefore)
  })
})
