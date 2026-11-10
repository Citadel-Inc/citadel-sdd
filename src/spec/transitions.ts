import type { SpecState } from './types.ts'

export type Transition =
  | 'spec_approve'
  | 'spec_claim'
  | 'spec_close'
  | 'spec_block'
  | 'spec_unblock'
  | 'spec_reopen'
  | 'spec_park'
  | 'spec_unpark'

export interface TransitionContext {
  claimerIsAuthor?: boolean
}

export type TransitionResult = { ok: true; to: SpecState } | { ok: false; error: string }

const DEST: Record<Transition, Partial<Record<SpecState, SpecState>>> = {
  spec_approve: { DRAFT: 'APPROVED' },
  spec_claim: { APPROVED: 'IN_PROGRESS' },
  spec_close: { IN_PROGRESS: 'DONE', PARKED: 'DONE' },
  spec_block: { IN_PROGRESS: 'BLOCKED' },
  spec_unblock: { BLOCKED: 'IN_PROGRESS' },
  spec_reopen: { DONE: 'IN_PROGRESS' },
  spec_park: { DRAFT: 'PARKED', APPROVED: 'PARKED', IN_PROGRESS: 'PARKED', BLOCKED: 'PARKED' },
  spec_unpark: { PARKED: 'IN_PROGRESS' },
}

const REQUIRED: Record<Transition, string> = {
  spec_approve: 'DRAFT',
  spec_claim: 'DRAFT or APPROVED',
  spec_close: 'IN_PROGRESS or PARKED',
  spec_block: 'IN_PROGRESS',
  spec_unblock: 'BLOCKED',
  spec_reopen: 'DONE',
  spec_park: 'DRAFT, APPROVED, IN_PROGRESS, or BLOCKED',
  spec_unpark: 'PARKED',
}

function claimFromDraft(ctx: TransitionContext): TransitionResult {
  if (ctx.claimerIsAuthor === true) {
    return { ok: true, to: 'IN_PROGRESS' }
  }
  return {
    ok: false,
    error: 'state_invalid: spec_claim from DRAFT requires claimer to be the spec author',
  }
}

export function canTransition(
  from: SpecState,
  via: Transition,
  ctx: TransitionContext = {},
): TransitionResult {
  if (via === 'spec_claim' && from === 'DRAFT') {
    return claimFromDraft(ctx)
  }
  if (via === 'spec_close' && from === 'BLOCKED') {
    return {
      ok: false,
      error:
        'state_invalid: spec_close requires IN_PROGRESS or PARKED, got BLOCKED — use spec_unblock first',
    }
  }
  const destinations = DEST[via]
  if (destinations === undefined) {
    return { ok: false, error: `transition_unknown: ${String(via)}` }
  }
  const to = destinations[from]
  if (to !== undefined) {
    return { ok: true, to }
  }
  return { ok: false, error: `state_invalid: ${via} requires ${REQUIRED[via]}, got ${from}` }
}

export function nextState(
  from: SpecState,
  via: Transition,
  ctx: TransitionContext = {},
): SpecState {
  const result = canTransition(from, via, ctx)
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.to
}

export function assertTransitionEnabled(
  via: Transition,
  disabledTransitions: readonly string[],
): void {
  if (disabledTransitions.includes(via)) {
    throw new Error(`transition_disabled: ${via} is disabled by profile`)
  }
}
