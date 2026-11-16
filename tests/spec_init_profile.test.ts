import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveProfile } from '../src/profile/resolver.ts'
import { specInit } from '../src/tools/spec_init.ts'
import type { ToolContext } from '../src/tools/types.ts'

function ctx(rootDir: string): ToolContext {
  return { rootDir, profile: resolveProfile({}) } as ToolContext
}

describe('spec_init', () => {
  test('refuses an unknown profile before writing config', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-init-profile-'))
    const git = (args: string[]) => {
      const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      if (r.status !== 0) {
        throw new Error(r.stderr)
      }
    }
    git(['init'])
    git(['config', 'user.name', 'Test'])
    git(['config', 'user.email', 'test@example.com'])
    expect(() => specInit({ profile: 'my-custom-profile' }, ctx(root))).toThrow(/unknown profile/)
  })

  test('scaffolds under overrides.spec_dir', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-init-specdir-'))
    const git = (args: string[]) => {
      const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
      if (r.status !== 0) {
        throw new Error(r.stderr)
      }
    }
    git(['init'])
    git(['config', 'user.name', 'Test'])
    git(['config', 'user.email', 'test@example.com'])
    const out = specInit({ overrides: { spec_dir: 'docs/specs' } }, ctx(root))
    expect(existsSync(join(root, 'docs/specs'))).toBe(true)
    expect(
      out.created_files.every(
        (p) => p.startsWith('docs/specs') || p.endsWith('config.yaml') || p.includes('config'),
      ),
    ).toBe(true)
    expect(out.created_files.some((p) => p.startsWith('docs/specs'))).toBe(true)
  })
})
