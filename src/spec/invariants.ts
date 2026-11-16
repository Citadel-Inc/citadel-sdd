import type { SpecLifecycleState } from './repo.ts'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ParsedSpec, ParsedTasks } from './types.ts'

export function assertDestinationFree(rootDir: string, destRelDir: string): void {
  if (existsSync(join(rootDir, destRelDir))) {
    throw new Error(`slug_collision: ${destRelDir} already exists`)
  }
}

export interface InvariantViolation {
  code: string
  message: string
}

export function checkSpecTasksStatusAlign(
  spec: ParsedSpec,
  tasks: ParsedTasks,
): InvariantViolation[] {
  if (spec.frontmatter.status.state !== tasks.frontmatter.status.state) {
    return [
      {
        code: 'status_drift',
        message: `spec.md status=${spec.frontmatter.status.state} ≠ tasks.md status=${tasks.frontmatter.status.state}`,
      },
    ]
  }
  return []
}

export function checkSlugInCorrectDir(
  spec: ParsedSpec,
  state: SpecLifecycleState,
): InvariantViolation[] {
  const st = spec.frontmatter.status.state
  const inDoneDir = state === 'done'
  const inParkedDir = state === 'parked'
  if (st === 'DONE' && !inDoneDir) {
    return [
      {
        code: 'path_mismatch',
        message: `state=${st} but not under done/`,
      },
    ]
  }
  if (st === 'PARKED' && !inParkedDir) {
    return [
      {
        code: 'path_mismatch',
        message: `state=${st} but not under parked/`,
      },
    ]
  }
  if (st !== 'DONE' && st !== 'PARKED' && (inDoneDir || inParkedDir)) {
    return [
      {
        code: 'path_mismatch',
        message: `state=${st} but lives in ${state}/`,
      },
    ]
  }
  return []
}
