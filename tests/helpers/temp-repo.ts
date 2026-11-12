import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderIndex } from '../../src/spec/index_render.ts'

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec-fixtures')

export interface TempRepo {
  rootDir: string
  cleanup: () => void
}

function git(rootDir: string, args: readonly string[]): void {
  execFileSync('git', ['-C', rootDir, ...args], { stdio: 'ignore' })
}

export interface TempRepoOptions {
  activeFixtures?: string[]
  doneFixtures?: string[]
  parkedFixtures?: string[]
}

/**
 * A committed repo for each distinct fixture set, built once per process. Copying a
 * template is one directory walk; building a repo from scratch is `git init`, three
 * `git config`, `git add` and `git commit` -- six process launches per test repo, and
 * process launches dominate this suite's wall time.
 */
const templates = new Map<string, string>()

function templateDir(opts: TempRepoOptions): string {
  const key = JSON.stringify([
    opts.activeFixtures ?? [],
    opts.doneFixtures ?? [],
    opts.parkedFixtures ?? [],
  ])
  const cached = templates.get(key)
  if (cached !== undefined) {
    return cached
  }
  const dir = mkdtempSync(join(tmpdir(), 'citadel-sdd-template-'))
  git(dir, ['init', '--initial-branch=main'])
  git(dir, ['config', 'user.name', 'Test Agent'])
  git(dir, ['config', 'user.email', 'test@example.com'])
  git(dir, ['config', 'commit.gpgsign', 'false'])

  mkdirSync(join(dir, 'specs', 'active'), { recursive: true })
  mkdirSync(join(dir, 'specs', 'done'), { recursive: true })
  mkdirSync(join(dir, 'specs', 'parked'), { recursive: true })

  for (const slug of opts.activeFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(dir, 'specs', 'active', slug), { recursive: true })
  }
  for (const slug of opts.doneFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(dir, 'specs', 'done', slug), { recursive: true })
  }
  for (const slug of opts.parkedFixtures ?? []) {
    cpSync(join(FIXTURES_ROOT, slug), join(dir, 'specs', 'parked', slug), { recursive: true })
  }

  writeFileSync(join(dir, 'specs', 'config.yaml'), 'extends: default\n')
  writeFileSync(join(dir, 'specs', 'README.md'), renderIndex({ rootDir: dir, specDir: 'specs' }))
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'initial fixture state'])

  templates.set(key, dir)
  return dir
}

process.on('exit', () => {
  for (const dir of templates.values()) {
    rmSync(dir, { recursive: true, force: true })
  }
})

export function makeTempRepo(opts: TempRepoOptions = {}): TempRepo {
  const rootDir = mkdtempSync(join(tmpdir(), 'citadel-sdd-test-'))
  cpSync(templateDir(opts), rootDir, { recursive: true })

  return {
    rootDir,
    cleanup() {
      rmSync(rootDir, { recursive: true, force: true })
    },
  }
}
