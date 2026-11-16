import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { resolveProfile } from '../src/profile/resolver.ts'
import { specList } from '../src/tools/spec_list.ts'
import type { ToolContext } from '../src/tools/types.ts'

function git(root: string, args: string[]): void {
  const r = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
  }
}

function specMd(owner: string, title: string): string {
  return `|          |                    |
| -------- | ------------------ |
| Status   | IN_PROGRESS 011920ZMAY26 |
| Owner    | ${owner}          |
| Approved | 011910ZMAY26       |

# ${title}
`
}

function tasksMd(): string {
  return `|          |                    |
| -------- | ------------------ |
| Status   | IN_PROGRESS 011920ZMAY26 |

# Tasks

## P0
`
}

function seed(root: string): void {
  git(root, ['init'])
  mkdirSync(join(root, 'specs/active/alice-spec'), { recursive: true })
  mkdirSync(join(root, 'specs/active/bob-spec'), { recursive: true })
  writeFileSync(join(root, 'specs/active/alice-spec/spec.md'), specMd('Alice', 'alice-spec'))
  writeFileSync(join(root, 'specs/active/alice-spec/tasks.md'), tasksMd())
  writeFileSync(join(root, 'specs/active/bob-spec/spec.md'), specMd('Bob', 'bob-spec'))
  writeFileSync(join(root, 'specs/active/bob-spec/tasks.md'), tasksMd())
}

describe('spec_list mine', () => {
  test('mine:true without git user.name errors instead of returning the whole backlog', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-list-mine-'))
    seed(root)
    const ctx = { rootDir: root, profile: resolveProfile({}) } as ToolContext
    expect(() => specList({ mine: true }, ctx)).toThrow(/user\.name/)
  })
})
