import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

interface PackageJson {
  scripts: Record<string, string>
}

function scripts(): Record<string, string> {
  const raw = readFileSync(join(ROOT, 'package.json'), 'utf8')
  return (JSON.parse(raw) as PackageJson).scripts
}

describe('test scripts', () => {
  // Most of the suite's wall time is per-file git process launches, which the OS can
  // overlap. Serial execution made the coverage gate step take ~20s.
  test('run test files in parallel', () => {
    expect(scripts().test).toMatch(/--parallel\b/)
    expect(scripts()['test:coverage']).toMatch(/--parallel\b/)
  })
})
