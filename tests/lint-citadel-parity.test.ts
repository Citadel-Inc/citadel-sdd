import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('absent python-lint reports PARITY: NOT RUN and exits non-zero', () => {
  const root = mkdtempSync(join(tmpdir(), 'citadel-parity-'))
  mkdirSync(join(root, 'specs', 'active'), { recursive: true })
  writeFileSync(join(root, 'specs', 'config.yaml'), '{}\n')
  const result = Bun.spawnSync({
    cmd: [
      'bun',
      join(import.meta.dir, '../scripts/lint-citadel-parity.ts'),
      '--citadel',
      root,
      '--python-lint',
      join(root, 'no-such-spec-status.py'),
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const out = `${result.stdout.toString()}${result.stderr.toString()}`
  expect(result.exitCode).not.toBe(0)
  expect(out).toContain('PARITY: NOT RUN')
})
