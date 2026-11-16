import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specBlock } from '../../src/tools/spec_block.ts'
import { specUnblock } from '../../src/tools/spec_unblock.ts'
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

describe('specBlock', () => {
  test('IN_PROGRESS -> BLOCKED with ## Blocking section', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const out = specBlock({ slug: 'in-progress-midway', reason: 'vendor lib unreleased' }, ctx())
    expect(out.before.state).toBe('IN_PROGRESS')
    expect(out.after.state).toBe('BLOCKED')
    const md = readFileSync(
      join(temp.rootDir, 'specs', 'active', 'in-progress-midway', 'spec.md'),
      'utf8',
    )
    expect(md).toContain('BLOCKED 011945ZMAY26 — vendor lib unreleased')
    expect(md).toContain('## Blocking')
    expect(md).toContain('vendor lib unreleased')
  })

  test('requires non-empty reason', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    expect(() => specBlock({ slug: 'in-progress-midway', reason: '' }, ctx())).toThrow(
      'reason_missing',
    )
  })

  test('rejects from non-IN_PROGRESS state', () => {
    temp = makeTempRepo({ activeFixtures: ['approved-ratified'] })
    expect(() => specBlock({ slug: 'approved-ratified', reason: 'x' }, ctx())).toThrow(
      'state_invalid',
    )
  })

  test('multi-line reason keeps the status table intact and can be unblocked', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    specBlock({ slug: 'in-progress-midway', reason: 'vendor lib unreleased\nETA unknown' }, ctx())
    const path = join(temp.rootDir, 'specs', 'active', 'in-progress-midway', 'spec.md')
    const blocked = readFileSync(path, 'utf8')
    expect(blocked.split('\n').filter((l) => l.startsWith('| Status |'))).toHaveLength(1)
    expect(blocked).toContain('| Owner | TestAgent |')

    specUnblock({ slug: 'in-progress-midway', resolution: 'vendor shipped' }, ctx())
    const unblocked = readFileSync(path, 'utf8')
    expect(unblocked).toContain('| Owner | TestAgent |')
    expect(unblocked).not.toContain('ETA unknown |')
    const malformed = unblocked
      .split('\n')
      .filter((l) => l.startsWith('|') && !/^\|[\s:|-]+\|$/.test(l) && !l.endsWith(' |'))
    expect(malformed).toEqual([])
  })
})
