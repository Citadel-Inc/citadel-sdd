/**
 * Regression: `commit: false` mutations are all-or-nothing. When a later step fails
 * (unparseable `specs/README.md`), files written earlier in the call are rolled back
 * and the tool's error leaves no partial mutation on disk.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specBlock } from '../../src/tools/spec_block.ts'
import { specHandoff } from '../../src/tools/spec_handoff.ts'
import { specUnblock } from '../../src/tools/spec_unblock.ts'
import { specUnpark } from '../../src/tools/spec_unpark.ts'
import type { ToolContext } from '../../src/tools/types.ts'
import { makeTempRepo, type TempRepo } from '../helpers/temp-repo.ts'

let temp: TempRepo | undefined

afterEach(() => {
  temp?.cleanup()
  temp = undefined
})

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0))

function ctx(): ToolContext {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  return { rootDir: temp.rootDir, profile: resolveBuiltIn('bastion'), clock: CLOCK }
}

/** Commit a README that fails the table parser, after the fixture repo was built. */
function corruptReadme(): void {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  const rootDir = temp.rootDir
  writeFileSync(join(rootDir, 'specs', 'README.md'), 'not a valid index\n')
  execFileSync('git', ['-C', rootDir, 'add', 'specs/README.md'], { stdio: 'ignore' })
  execFileSync('git', ['-C', rootDir, 'commit', '-m', 'corrupt readme'], { stdio: 'ignore' })
}

function read(relPath: string): string {
  return readFileSync(join(temp?.rootDir ?? '', relPath), 'utf8')
}

function status(): string {
  return execFileSync('git', ['-C', temp?.rootDir ?? '', 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim()
}

describe('commit:false writes all files or none', () => {
  test('spec_block leaves spec.md and tasks.md untouched when the README is unparseable', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const specBefore = read('specs/active/in-progress-midway/spec.md')
    const tasksBefore = read('specs/active/in-progress-midway/tasks.md')
    corruptReadme()

    expect(() =>
      specBlock(
        { slug: 'in-progress-midway', reason: 'vendor lib unreleased', commit: false },
        ctx(),
      ),
    ).toThrow('readme_unparseable')
    expect(read('specs/active/in-progress-midway/spec.md')).toBe(specBefore)
    expect(read('specs/active/in-progress-midway/tasks.md')).toBe(tasksBefore)
    expect(status()).toBe('')
  })

  test('spec_unblock leaves spec.md and tasks.md untouched when the README is unparseable', () => {
    temp = makeTempRepo({ activeFixtures: ['blocked-reason'] })
    const specBefore = read('specs/active/blocked-reason/spec.md')
    const tasksBefore = read('specs/active/blocked-reason/tasks.md')
    corruptReadme()

    expect(() =>
      specUnblock(
        { slug: 'blocked-reason', resolution: 'dependency shipped', commit: false },
        ctx(),
      ),
    ).toThrow('readme_unparseable')
    expect(read('specs/active/blocked-reason/spec.md')).toBe(specBefore)
    expect(read('specs/active/blocked-reason/tasks.md')).toBe(tasksBefore)
    expect(status()).toBe('')
  })

  test('spec_unpark leaves the spec in parked/ when the README is unparseable', () => {
    temp = makeTempRepo({ parkedFixtures: ['parked-minimal'] })
    const specBefore = read('specs/parked/parked-minimal/spec.md')
    const tasksBefore = read('specs/parked/parked-minimal/tasks.md')
    corruptReadme()

    expect(() =>
      specUnpark({ slug: 'parked-minimal', resolution: 'revived', commit: false }, ctx()),
    ).toThrow('readme_unparseable')
    expect(read('specs/parked/parked-minimal/spec.md')).toBe(specBefore)
    expect(read('specs/parked/parked-minimal/tasks.md')).toBe(tasksBefore)
    expect(status()).toBe('')
  })

  test('spec_handoff leaves the owner unchanged when the README is unparseable', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const specBefore = read('specs/active/in-progress-midway/spec.md')
    corruptReadme()

    expect(() =>
      specHandoff({ slug: 'in-progress-midway', new_owner: 'Someone', commit: false }, ctx()),
    ).toThrow('readme_unparseable')
    expect(read('specs/active/in-progress-midway/spec.md')).toBe(specBefore)
    expect(status()).toBe('')
  })
})
