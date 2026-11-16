import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { resolveProfile } from '../src/profile/resolver.ts'
import { specLint } from '../src/tools/spec_lint.ts'
import type { ToolContext } from '../src/tools/types.ts'

function ctx(rootDir: string): ToolContext {
  return {
    rootDir,
    profile: resolveProfile({}),
  } as ToolContext
}

function treeWithUnparseableSpec(): string {
  const root = mkdtempSync(join(tmpdir(), 'sdd-lint-fail-on-'))
  mkdirSync(join(root, 'specs/active/broken'), { recursive: true })
  writeFileSync(join(root, 'specs/active/broken/spec.md'), '# no frontmatter\n')
  writeFileSync(join(root, 'specs/active/broken/tasks.md'), '## Now\n\n- [ ] x\n')
  return root
}

describe('spec_lint fail_on', () => {
  test('error findings still fail the exit code when fail_on is set', () => {
    const c = ctx(treeWithUnparseableSpec())
    const baseline = specLint({}, c)
    expect(baseline.exit_code).toBe(1)
    expect(baseline.findings.some((f) => f.code === 'spec_md_unparseable')).toBe(true)

    for (const fail_on of [[], ['nope'], ['stale']] as const) {
      const out = specLint({ fail_on: [...fail_on] }, c)
      expect(out.exit_code).toBe(1)
      expect(out.findings.some((f) => f.code === 'spec_md_unparseable')).toBe(true)
    }
  })
})
