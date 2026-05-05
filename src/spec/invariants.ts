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
  const st = spec.frontmatter.status.state;
  const inDoneDir = state === "done";
  const inParkedDir = state === "parked";
  if (st === "DONE" && !inDoneDir) {
    return [
      {
        code: "path_mismatch",
        message: `state=${st} but not under done/`,
      },
    ];
  }
  if (st === "PARKED" && !inParkedDir) {
    return [
      {
        code: "path_mismatch",
        message: `state=${st} but not under parked/`,
      },
    ];
  }
  if (st !== "DONE" && st !== "PARKED" && (inDoneDir || inParkedDir)) {
    return [
      {
        code: "path_mismatch",
        message: `state=${st} but lives in ${state}/`,
      },
    ];
  }
  return [];
}
