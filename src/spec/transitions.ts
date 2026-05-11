import type { SpecState } from "./types.js";

export type Transition =
  | "spec_approve"
  | "spec_claim"
  | "spec_close"
  | "spec_block"
  | "spec_unblock"
  | "spec_reopen"
  | "spec_park"
  | "spec_unpark";

export interface TransitionContext {
  claimerIsAuthor?: boolean;
}

export type TransitionResult = { ok: true; to: SpecState } | { ok: false; error: string };

export function canTransition(
  from: SpecState,
  via: Transition,
  ctx: TransitionContext = {},
): TransitionResult {
  switch (via) {
    case "spec_approve":
      if (from === "DRAFT") return { ok: true, to: "APPROVED" };
      return { ok: false, error: `state_invalid: spec_approve requires DRAFT, got ${from}` };

    case "spec_claim":
      if (from === "APPROVED") return { ok: true, to: "IN_PROGRESS" };
      if (from === "DRAFT") {
        if (ctx.claimerIsAuthor === true) return { ok: true, to: "IN_PROGRESS" };
        return {
          ok: false,
          error: "state_invalid: spec_claim from DRAFT requires claimer to be the spec author",
        };
      }
      return {
        ok: false,
        error: `state_invalid: spec_claim requires DRAFT or APPROVED, got ${from}`,
      };

    case "spec_close":
      if (from === "IN_PROGRESS") return { ok: true, to: "DONE" };
      if (from === "PARKED") return { ok: true, to: "DONE" };
      if (from === "BLOCKED") {
        return {
          ok: false,
          error:
            "state_invalid: spec_close requires IN_PROGRESS or PARKED, got BLOCKED — use spec_unblock first",
        };
      }
      return {
        ok: false,
        error: `state_invalid: spec_close requires IN_PROGRESS or PARKED, got ${from}`,
      };

    case "spec_block":
      if (from === "IN_PROGRESS") return { ok: true, to: "BLOCKED" };
      return { ok: false, error: `state_invalid: spec_block requires IN_PROGRESS, got ${from}` };

    case "spec_unblock":
      if (from === "BLOCKED") return { ok: true, to: "IN_PROGRESS" };
      return { ok: false, error: `state_invalid: spec_unblock requires BLOCKED, got ${from}` };

    case "spec_reopen":
      if (from === "DONE") return { ok: true, to: "IN_PROGRESS" };
      return { ok: false, error: `state_invalid: spec_reopen requires DONE, got ${from}` };

    case "spec_park":
      if (from === "DRAFT" || from === "APPROVED" || from === "IN_PROGRESS" || from === "BLOCKED") {
        return { ok: true, to: "PARKED" };
      }
      return {
        ok: false,
        error: `state_invalid: spec_park requires DRAFT, APPROVED, IN_PROGRESS, or BLOCKED, got ${from}`,
      };

    case "spec_unpark":
      if (from === "PARKED") return { ok: true, to: "IN_PROGRESS" };
      return { ok: false, error: `state_invalid: spec_unpark requires PARKED, got ${from}` };
  }
}

export function nextState(
  from: SpecState,
  via: Transition,
  ctx: TransitionContext = {},
): SpecState {
  const result = canTransition(from, via, ctx);
  if (!result.ok) throw new Error(result.error);
  return result.to;
}

export function assertTransitionEnabled(
  via: Transition,
  disabledTransitions: readonly string[],
): void {
  if (disabledTransitions.includes(via)) {
    throw new Error(`transition_disabled: ${via} is disabled by profile`);
  }
}
