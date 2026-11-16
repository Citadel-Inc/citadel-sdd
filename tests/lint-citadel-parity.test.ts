import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('absent python-lint reports PARITY: NOT RUN and exits non-zero', () => {
  const root = mkdtempSync(join(tmpdir(), 'citadel-parity-'))
  mkdirSync(join(root, 'specs', 'active'), { recursive: true })
  writeFileSync(join(root, 'specs', 'config.yaml'), '{}\n')
  let status = 0
  let out = ''
  try {
    out = execFileSync(
      'bun',
      [
        join(import.meta.dir, '../scripts/lint-citadel-parity.ts'),
        '--citadel',
        root,
        '--python-lint',
        join(root, 'no-such-spec-status.py'),
      ],
      { encoding: 'utf8' },
    )
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    status = typeof err.status === 'number' ? err.status : 1
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
  expect(status).not.toBe(0)
  expect(out).toContain('PARITY: NOT RUN')
})
