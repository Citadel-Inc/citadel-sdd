import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { resolveProfile } from '../src/profile/resolver.ts'
import { specApprove } from '../src/tools/spec_approve.ts'
import { specInit } from '../src/tools/spec_init.ts'
import type { ToolContext } from '../src/tools/types.ts'

function git(root: string, args: string[]): void {
  const r = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
  }
}

describe('transition history', () => {
  test('spec_approve appends a History row', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-history-'))
    git(root, ['init'])
    git(root, ['config', 'user.name', 'Test'])
    git(root, ['config', 'user.email', 'test@example.com'])
    const ctx = { rootDir: root, profile: resolveProfile({}) } as ToolContext
    specInit({}, ctx)
    mkdirSync(join(root, 'specs/active/hist'), { recursive: true })
    writeFileSync(
      join(root, 'specs/active/hist/spec.md'),
      `|          |                    |
| -------- | ------------------ |
| Status   | DRAFT 011900ZMAY26 |
| Owner    | TestAgent          |
| Approved | TBD                |

# hist

## History

- 011800ZMAY26 — created
`,
    )
    writeFileSync(
      join(root, 'specs/active/hist/tasks.md'),
      `|          |                    |
| -------- | ------------------ |
| Status   | DRAFT 011900ZMAY26 |

# Tasks

## P0
`,
    )
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'seed'])
    specApprove({ slug: 'hist', commit: false }, ctx)
    const body = readFileSync(join(root, 'specs/active/hist/spec.md'), 'utf8')
    const rows = [...body.matchAll(/^- /gm)]
    expect(rows.length).toBeGreaterThan(1)
  })
})
