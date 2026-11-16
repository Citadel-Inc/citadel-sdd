import { afterEach, describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specTaskCheck } from '../../src/tools/spec_task_check.ts'
import type { ToolContext } from '../../src/tools/types.ts'
import { makeTempRepo, type TempRepo } from '../helpers/temp-repo.ts'

const STATUS_LINE_RE = /^Status:/m

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

describe('specTaskCheck', () => {
  test('check by 1-based index', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskCheck(
      { slug: 'draft-minimal', items: [{ phase: 'P0', match: 2, checked: true }] },
      ctx(),
    )
    expect(out.before.checked).toBe(false)
    expect(out.after.checked).toBe(true)
    const tasks = readFileSync(
      join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'tasks.md'),
      'utf8',
    )
    expect(tasks).toContain('- [x] First task')
  })

  test('check by text-prefix match', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    specTaskCheck(
      { slug: 'draft-minimal', items: [{ phase: 'P0', match: 'First', checked: true }] },
      ctx(),
    )
    const tasks = readFileSync(
      join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'tasks.md'),
      'utf8',
    )
    expect(tasks).toContain('- [x] First task')
  })

  test('uncheck flips x → space', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-midway'] })
    const out = specTaskCheck(
      { slug: 'in-progress-midway', items: [{ phase: 'P0', match: 'Scaffold', checked: false }] },
      ctx(),
    )
    expect(out.before.checked).toBe(true)
    expect(out.after.checked).toBe(false)
  })

  test('dryRun no write', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const path = join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'tasks.md')
    const before = readFileSync(path, 'utf8')
    specTaskCheck(
      { slug: 'draft-minimal', items: [{ phase: 'P0', match: 1, checked: true }], dryRun: true },
      ctx(),
    )
    expect(readFileSync(path, 'utf8')).toBe(before)
  })

  test('task_not_found error includes available task text', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    let msg = ''
    try {
      specTaskCheck(
        { slug: 'draft-minimal', items: [{ phase: 'P0', match: 'ZZZ', checked: true }] },
        ctx(),
      )
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('task_not_found')
    expect(msg).toContain('available')
  })

  test('out-of-range index throws', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    expect(() =>
      specTaskCheck(
        { slug: 'draft-minimal', items: [{ phase: 'P0', match: 99, checked: true }] },
        ctx(),
      ),
    ).toThrow('task_not_found')
  })

  test('inline-format tasks.md: check succeeds and preserves Status line', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-inline'] })
    const out = specTaskCheck(
      {
        slug: 'in-progress-inline',
        items: [{ phase: 'P0', match: 'Land renderer', checked: true }],
      },
      ctx(),
    )
    expect(out.before.checked).toBe(false)
    expect(out.after.checked).toBe(true)
    const tasks = readFileSync(
      join(temp.rootDir, 'specs', 'active', 'in-progress-inline', 'tasks.md'),
      'utf8',
    )
    expect(tasks).toContain('- [x] Land renderer')
    expect(tasks).toMatch(STATUS_LINE_RE)
  })

  test('output includes matched_text and matched_index', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskCheck(
      { slug: 'draft-minimal', items: [{ phase: 'P0', match: 2, checked: true }] },
      ctx(),
    )
    expect(out.matched_index).toBe(2)
    expect(typeof out.matched_text).toBe('string')
    expect(out.matched_text.length).toBeGreaterThan(0)
    expect(out.results).toHaveLength(1)
    expect(out.results[0]?.matched_index).toBe(2)
  })

  test('batch items — checks multiple tasks in one call, one commit', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specTaskCheck(
      {
        slug: 'draft-minimal',
        items: [
          { phase: 'P0', match: 1, checked: true },
          { phase: 'P0', match: 2, checked: true },
        ],
        commit: false,
      },
      ctx(),
    )
    expect(out.results).toHaveLength(2)
    expect(out.results[0]?.after.checked).toBe(true)
    expect(out.results[1]?.after.checked).toBe(true)
    const tasks = readFileSync(
      join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'tasks.md'),
      'utf8',
    )
    expect(tasks).toContain('- [x]')
  })

  test('batch dryRun — returns results without writing', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const path = join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'tasks.md')
    const before = readFileSync(path, 'utf8')
    const out = specTaskCheck(
      {
        slug: 'draft-minimal',
        items: [
          { phase: 'P0', match: 1, checked: true },
          { phase: 'P1', match: 1, checked: true },
        ],
        dryRun: true,
      },
      ctx(),
    )
    expect(out.dryRun).toBe(true)
    expect(out.results).toHaveLength(2)
    expect(out.results[0]?.matched_text.length).toBeGreaterThan(0)
    expect(readFileSync(path, 'utf8')).toBe(before)
  })

  test('batch stops on first task_not_found', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    expect(() =>
      specTaskCheck(
        {
          slug: 'draft-minimal',
          items: [
            { phase: 'P0', match: 1, checked: true },
            { phase: 'P0', match: 'NO_SUCH_TASK', checked: true },
          ],
          commit: false,
        },
        ctx(),
      ),
    ).toThrow('task_not_found')
  })

  test('inline-format tasks.md: dryRun does not throw and does not write', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-inline'] })
    const path = join(temp.rootDir, 'specs', 'active', 'in-progress-inline', 'tasks.md')
    const before = readFileSync(path, 'utf8')
    expect(() =>
      specTaskCheck(
        {
          slug: 'in-progress-inline',
          items: [{ phase: 'P1', match: 1, checked: false }],
          dryRun: true,
        },
        ctx(),
      ),
    ).not.toThrow()
    expect(readFileSync(path, 'utf8')).toBe(before)
  })

  test('throws when items[] is empty', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    expect(() => specTaskCheck({ slug: 'draft-minimal', items: [] }, ctx())).toThrow(
      'items_missing',
    )
  })
})

describe('specTaskCheck — indented sub-items', () => {
  test('indented sub-item stays in place and keeps its indent', () => {
    temp = makeTempRepo({ activeFixtures: ['in-progress-inline'] })
    const tasksPath = join(temp.rootDir, 'specs', 'active', 'in-progress-inline', 'tasks.md')
    writeFileSync(
      tasksPath,
      '# T\n\n| | |\n|---|---|\n| Status | IN_PROGRESS 011920ZMAY26 |\n\n## P0\n\n- [ ] parent one\n  - [ ] child of one\nNotes about P0 go here.\n\n- [x] parent two\n',
    )
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fix`)

    specTaskCheck(
      {
        slug: 'in-progress-inline',
        items: [{ phase: 'P0', match: 'parent one', checked: true }],
      },
      ctx(),
    )

    const tasks = readFileSync(tasksPath, 'utf8')
    expect(tasks).toContain('  - [ ] child of one')
    expect(tasks).toContain('Notes about P0 go here.')
    expect(tasks).toContain('- [x] parent one')
    expect(tasks.indexOf('- [x] parent one')).toBeLessThan(tasks.indexOf('  - [ ] child of one'))
  })
})
