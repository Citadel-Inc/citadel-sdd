import type { SpecLifecycleState } from "./repo.js";
import type { ParsedSpec, ParsedTasks } from "./types.js";

export interface InvariantViolation {
  code: string;
  message: string;
}

export function checkSpecTasksStatusAlign(
  spec: ParsedSpec,
  tasks: ParsedTasks,
): InvariantViolation[] {
  if (spec.frontmatter.status.state !== tasks.frontmatter.status.state) {
    return [
      {
        code: "status_drift",
        message: `spec.md status=${spec.frontmatter.status.state} ≠ tasks.md status=${tasks.frontmatter.status.state}`,
      },
    ];
  }
  return [];
}

export function checkSlugInCorrectDir(
  spec: ParsedSpec,
  state: SpecLifecycleState,
): InvariantViolation[] {
  const isDone = spec.frontmatter.status.state === "DONE";
  const inDoneDir = state === "done";
  if (isDone !== inDoneDir) {
    return [
      {
        code: "path_mismatch",
        message: `state=${spec.frontmatter.status.state} but lives in ${state}/`,
      },
    ];
  }
  return [];
}
