import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../../src/profile/resolver.ts'
import { specApprove } from '../../src/tools/spec_approve.ts'
import { specRead } from '../../src/tools/spec_read.ts'
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
  return { rootDir: temp.rootDir, profile: resolveBuiltIn('default') }
}

describe('specRead', () => {
  test('default returns all three parts', () => {
    temp = makeTempRepo({ activeFixtures: ['approved-ratified'] })
    const out = specRead({ slug: 'approved-ratified' }, ctx())
    expect(out.slug).toBe('approved-ratified')
    expect(out.state).toBe('active')
    expect(out.spec_md).toContain('APPROVED')
    expect(out.plan_md).toContain('Phase 1')
    expect(out.tasks_md).toContain('[HUMAN]')
  })

  test('parts:[spec] returns only spec_md', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const out = specRead({ slug: 'draft-minimal', parts: ['spec'] }, ctx())
    expect(out.spec_md).not.toBeNull()
    expect(out.plan_md).toBeNull()
    expect(out.tasks_md).toBeNull()
  })

  test('done fixture readable from done/ dir', () => {
    temp = makeTempRepo({ doneFixtures: ['done'] })
    const out = specRead({ slug: 'done' }, ctx())
    expect(out.state).toBe('done')
  })

  test('unknown slug throws spec_not_found', () => {
    temp = makeTempRepo()
    expect(() => specRead({ slug: 'missing' }, ctx())).toThrow('spec_not_found')
  })

  test('symlinked spec.md throws', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const specPath = join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'spec.md')
    const envPath = join(temp.rootDir, '.env')
    writeFileSync(envPath, 'SECRET=1\n')
    unlinkSync(specPath)
    symlinkSync(envPath, specPath)
    expect(() => specRead({ slug: 'draft-minimal' }, ctx())).toThrow('path_is_symlink')
  })

  test('spec_approve commit:false on a symlinked target throws', () => {
    temp = makeTempRepo({ activeFixtures: ['draft-minimal'] })
    const specPath = join(temp.rootDir, 'specs', 'active', 'draft-minimal', 'spec.md')
    const outside = join(temp.rootDir, 'outside-spec.md')
    writeFileSync(outside, readFileSync(specPath, 'utf8'))
    unlinkSync(specPath)
    symlinkSync(outside, specPath)
    expect(() => specApprove({ slug: 'draft-minimal', commit: false }, ctx())).toThrow(/symlink/)
  })
})
