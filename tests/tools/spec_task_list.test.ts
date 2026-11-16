import { afterEach, describe, expect, test } from 'bun:test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specTaskList } from '../../src/tools/spec_task_list.ts'
import type { ToolContext } from '../../src/tools/types.ts'
import { makeTempRepo, type TempRepo } from '../helpers/temp-repo.ts'

let temp: TempRepo | undefined

afterEach(() => {
  temp?.cleanup()
  temp = undefined
})

function ctx(): ToolContext {
  if (!temp) {
    throw new Error('temp repo not initialized')
  }
  return { rootDir: temp.rootDir, profile: resolveBuiltIn('bastion') }
}

describe('specTaskList', () => {
  test('returns all items across phases', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskList({ slug: 'draft-minimal' }, ctx())
    expect(out.items.length).toBeGreaterThan(0)
    expect(out.total).toBe(out.items.length)
    expect(out.items.every((i) => typeof i.text === 'string' && i.text.length > 0)).toBe(true)
    expect(out.items.every((i) => typeof i.checked === 'boolean')).toBe(true)
    expect(out.items.every((i) => i.index >= 1)).toBe(true)
  })

  test('index is 1-based and sequential per phase', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskList({ slug: 'draft-minimal' }, ctx())
    for (const phase of ['P0', 'P1', 'P2'] as const) {
      const phaseItems = out.items.filter((i) => i.phase === phase)
      phaseItems.forEach((item, pos) => {
        expect(item.index).toBe(pos + 1)
      })
    }
  })

  test('phases filter restricts output to requested phases', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskList({ slug: 'draft-minimal', phases: ['P0'] }, ctx())
    expect(out.items.every((i) => i.phase === 'P0')).toBe(true)
  })

  test('unchecked count is accurate', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const out = specTaskList({ slug: 'in-progress-midway' }, ctx())
    const actualUnchecked = out.items.filter((i) => !i.checked).length
    expect(out.unchecked).toBe(actualUnchecked)
  })

  test('isHumanGate flagged correctly', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskList({ slug: 'draft-minimal' }, ctx())
    const gates = out.items.filter((i) => i.isHumanGate)
    expect(gates.length).toBeGreaterThan(0)
    expect(gates.every((i) => i.text.includes('[HUMAN]'))).toBe(true)
  })

  test('done fixture — all items checked, unchecked=0', () => {
    temp = makeTempRepo({ activeFixtures: ['done'] })
    const out = specTaskList({ slug: 'done' }, ctx())
    expect(out.unchecked).toBe(0)
    expect(out.items.every((i) => i.checked)).toBe(true)
  })

  test('spec_not_found throws for unknown slug', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    expect(() => specTaskList({ slug: 'no-such-spec' }, ctx())).toThrow('spec_not_found')
  })

  test('indented sub-items are listed and counted open', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-inline'] })
    const path = join(temp.rootDir, 'specs', 'active', 'in-progress-inline', 'tasks.md')
    writeFileSync(
      path,
      '# T\n\n| | |\n|---|---|\n| Status | IN_PROGRESS 011920ZMAY26 |\n\n## P0\n\n- [x] parent done\n  - [ ] nested child still open\n\n## P1\n\n- [x] done\n\n## P2\n\n- [x] done\n',
    )
    const out = specTaskList({ slug: 'in-progress-inline' }, ctx())
    expect(out.items.map((i) => i.text)).toContain('nested child still open')
    expect(out.unchecked).toBe(1)
  })
})
