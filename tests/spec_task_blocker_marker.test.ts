import { describe, expect, test } from 'bun:test'
import { addTaskItem } from '../src/spec/mutate.ts'
import type { ParsedTasks } from '../src/spec/types.ts'

describe('addTaskItem blocker marker', () => {
  test('blocker:true writes the canonical [HUMAN] marker', () => {
    const tasks = {
      frontmatter: { status: { state: 'ACTIVE', dtg: '011800ZMAY26' }, fields: [] },
      phases: { P0: [], P1: [], P2: [] },
    } as unknown as ParsedTasks
    const updated = addTaskItem(tasks, 'P0', 'wait on vendor', true)
    const item = updated.phases.P0[0]
    expect(item?.text).toBe('[HUMAN] wait on vendor')
    expect(item?.isHumanGate).toBe(true)
    expect(item?.text.includes('[BLOCKED]')).toBe(false)
  })
})
