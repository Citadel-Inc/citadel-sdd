import { afterEach, describe, expect, test } from 'bun:test'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBuiltIn } from '../src/profile/resolver.ts'
import { specClaim } from '../src/tools/spec_claim.ts'
import type { ToolContext } from '../src/tools/types.ts'
import { makeTempRepo, type TempRepo } from './helpers/temp-repo.ts'

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

describe('spec_claim owner transfer', () => {
  test('claim by non-owner becomes Owner and records who it was taken from', () => {
    temp = makeTempRepo()
    const dir = join(temp.rootDir, 'specs', 'active', 'approved-alice')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'spec.md'),
      `# Widget

| | |
|---|---|
| Status | APPROVED 011910ZMAY26 |
| Owner | Alice |
`,
    )
    writeFileSync(join(dir, 'plan.md'), '')
    writeFileSync(join(dir, 'tasks.md'), '| | |\n|---|---|\n| Status | APPROVED 011910ZMAY26 |\n')
    execSync('git add -A && git commit -qm fixture', { cwd: temp.rootDir })

    specClaim({ slug: 'approved-alice', claimer: 'Bob', ratify: false, commit: false }, ctx())
    const md = readFileSync(join(dir, 'spec.md'), 'utf8')
    expect(md).toContain('| Owner | Bob |')
    expect(md).toContain('Bob claims execution (from Alice)')
  })

  test('repeat claim by the new owner reports already in progress', () => {
    temp = makeTempRepo()
    const dir = join(temp.rootDir, 'specs', 'active', 'approved-alice')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'spec.md'),
      `# Widget

| | |
|---|---|
| Status | APPROVED 011910ZMAY26 |
| Owner | Alice |
`,
    )
    writeFileSync(join(dir, 'plan.md'), '')
    writeFileSync(join(dir, 'tasks.md'), '| | |\n|---|---|\n| Status | APPROVED 011910ZMAY26 |\n')
    execSync('git add -A && git commit -qm fixture', { cwd: temp.rootDir })

    specClaim({ slug: 'approved-alice', claimer: 'Bob', ratify: false, commit: false }, ctx())
    expect(() =>
      specClaim({ slug: 'approved-alice', claimer: 'Bob', ratify: false, commit: false }, ctx()),
    ).toThrow('state_invalid')
    const md = readFileSync(join(dir, 'spec.md'), 'utf8')
    expect(md).toContain('| Owner | Bob |')
  })
})
