import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { resolveProfile } from '../src/profile/resolver.ts'
import { specClose } from '../src/tools/spec_close.ts'
import type { ToolContext } from '../src/tools/types.ts'

function git(root: string, args: string[]): void {
  const r = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
  }
}

function specMd(title: string, status: string): string {
  return `|          |                    |
| -------- | ------------------ |
| Status   | ${status} |
| Owner    | TestAgent          |
| Approved | TBD                |

# ${title}
`
}

function tasksMd(status: string): string {
  return `|          |                    |
| -------- | ------------------ |
| Status   | ${status} |

# Tasks

## P0

## P1

## P2
`
}

describe('spec_close slug_collision', () => {
  test('refuses to nest into an existing destination slug', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-close-collision-'))
    git(root, ['init'])
    git(root, ['config', 'user.name', 'Test'])
    git(root, ['config', 'user.email', 'test@example.com'])
    mkdirSync(join(root, 'specs/active/dup'), { recursive: true })
    mkdirSync(join(root, 'specs/done/dup'), { recursive: true })
    writeFileSync(
      join(root, 'specs/active/dup/spec.md'),
      specMd('active dup', 'IN_PROGRESS 011920ZMAY26'),
    )
    writeFileSync(join(root, 'specs/active/dup/tasks.md'), tasksMd('IN_PROGRESS 011920ZMAY26'))
    writeFileSync(join(root, 'specs/done/dup/spec.md'), `${specMd('old dup', 'DONE 011800ZMAY26')}`)
    writeFileSync(join(root, 'specs/done/dup/tasks.md'), tasksMd('DONE 011800ZMAY26'))
    writeFileSync(join(root, 'specs/README.md'), '# Specs\n')
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'seed'])

    const ctx = { rootDir: root, profile: resolveProfile({}) } as ToolContext
    expect(() => specClose({ slug: 'dup', summary: 'closing', commit: false }, ctx)).toThrow(
      /slug_collision/,
    )
    expect(readFileSync(join(root, 'specs/done/dup/spec.md'), 'utf8')).toContain('# old dup')
    expect(existsSync(join(root, 'specs/done/dup/dup'))).toBe(false)
  })
})
