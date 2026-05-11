import { describe, expect, test } from "bun:test";
import { canTransition, nextState, type Transition } from "../../src/spec/transitions.js";
import type { SpecState } from "../../src/spec/types.js";
import { SPEC_STATES } from "../../src/spec/types.js";

const ALL_STATES: ReadonlyArray<SpecState> = [
  "DRAFT",
  "APPROVED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "PARKED",
];

const ALL_TRANSITIONS: ReadonlyArray<Transition> = [
  "spec_approve",
  "spec_claim",
  "spec_close",
  "spec_block",
  "spec_unblock",
  "spec_reopen",
  "spec_park",
  "spec_unpark",
];

describe("canTransition — legal moves", () => {
  test("spec_approve: DRAFT → APPROVED", () => {
    const r = canTransition("DRAFT", "spec_approve");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("APPROVED");
  });

  test("spec_claim: APPROVED → IN_PROGRESS (no claimer-is-author needed)", () => {
    const r = canTransition("APPROVED", "spec_claim");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("IN_PROGRESS");
  });

  test("spec_claim: DRAFT → IN_PROGRESS allowed when claimer is author", () => {
    const r = canTransition("DRAFT", "spec_claim", { claimerIsAuthor: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("IN_PROGRESS");
  });

  test("spec_close: IN_PROGRESS → DONE", () => {
    const r = canTransition("IN_PROGRESS", "spec_close");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("DONE");
  });

  test("spec_close: PARKED → DONE (abandon parked spec)", () => {
    const r = canTransition("PARKED", "spec_close");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("DONE");
  });

  test("spec_unpark: PARKED → IN_PROGRESS", () => {
    const r = canTransition("PARKED", "spec_unpark");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("IN_PROGRESS");
  });

  test("spec_block: IN_PROGRESS → BLOCKED", () => {
    const r = canTransition("IN_PROGRESS", "spec_block");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("BLOCKED");
  });

  test("spec_unblock: BLOCKED → IN_PROGRESS", () => {
    const r = canTransition("BLOCKED", "spec_unblock");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("IN_PROGRESS");
  });

  test("spec_park: DRAFT → PARKED", () => {
    const r = canTransition("DRAFT", "spec_park");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("PARKED");
  });

  test("spec_park: IN_PROGRESS → PARKED", () => {
    const r = canTransition("IN_PROGRESS", "spec_park");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.to).toBe("PARKED");
  });

  test("spec_park: DONE rejected", () => {
    const r = canTransition("DONE", "spec_park");
    expect(r.ok).toBe(false);
  });
});

describe("canTransition — illegal moves", () => {
  test("spec_claim: DRAFT without claimer-is-author is rejected", () => {
    const r = canTransition("DRAFT", "spec_claim", { claimerIsAuthor: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("spec author");
  });

  test("spec_claim: DRAFT with no context is rejected", () => {
    const r = canTransition("DRAFT", "spec_claim");
    expect(r.ok).toBe(false);
  });

  test("spec_approve from APPROVED rejected", () => {
    const r = canTransition("APPROVED", "spec_approve");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("requires DRAFT");
  });

  test("spec_close from APPROVED rejected (must claim first)", () => {
    const r = canTransition("APPROVED", "spec_close");
    expect(r.ok).toBe(false);
  });

  test("spec_close from DRAFT rejected (DRAFT → DONE direct invalid)", () => {
    const r = canTransition("DRAFT", "spec_close");
    expect(r.ok).toBe(false);
  });

  test("spec_close from BLOCKED rejected with unblock hint", () => {
    const r = canTransition("BLOCKED", "spec_close");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("spec_unblock");
  });

  test("spec_unpark from IN_PROGRESS rejected", () => {
    const r = canTransition("IN_PROGRESS", "spec_unpark");
    expect(r.ok).toBe(false);
  });

  test("spec_unpark from DONE rejected", () => {
    const r = canTransition("DONE", "spec_unpark");
    expect(r.ok).toBe(false);
  });

  test("spec_block from APPROVED rejected (BLOCKED reachable only from IN_PROGRESS)", () => {
    const r = canTransition("APPROVED", "spec_block");
    expect(r.ok).toBe(false);
  });

  test("spec_block from BLOCKED rejected (no double-block)", () => {
    const r = canTransition("BLOCKED", "spec_block");
    expect(r.ok).toBe(false);
  });

  test("spec_unblock from IN_PROGRESS rejected", () => {
    const r = canTransition("IN_PROGRESS", "spec_unblock");
    expect(r.ok).toBe(false);
  });

  test("spec_reopen from IN_PROGRESS rejected", () => {
    const r = canTransition("IN_PROGRESS", "spec_reopen");
    expect(r.ok).toBe(false);
  });

  test("spec_reopen from DRAFT rejected (DONE → DRAFT not allowed; reopen → IN_PROGRESS)", () => {
    const r = canTransition("DRAFT", "spec_reopen");
    expect(r.ok).toBe(false);
  });
});

describe("canTransition — exhaustive matrix", () => {
  test("each (state, transition) pair is either explicitly legal or rejected", () => {
    const legal = new Set<string>([
      "DRAFT|spec_approve",
      "DRAFT|spec_claim", // gated on claimerIsAuthor
      "APPROVED|spec_claim",
      "IN_PROGRESS|spec_close",
      "PARKED|spec_close",
      "IN_PROGRESS|spec_block",
      "BLOCKED|spec_unblock",
      "DONE|spec_reopen",
      "DRAFT|spec_park",
      "APPROVED|spec_park",
      "IN_PROGRESS|spec_park",
      "BLOCKED|spec_park",
      "PARKED|spec_unpark",
    ]);

    for (const state of ALL_STATES) {
      for (const via of ALL_TRANSITIONS) {
        const key = `${state}|${via}`;
        const ctx = via === "spec_claim" && state === "DRAFT" ? { claimerIsAuthor: true } : {};
        const result = canTransition(state, via, ctx);
        if (legal.has(key)) {
          expect({ key, ok: result.ok }).toEqual({ key, ok: true });
        } else {
          expect({ key, ok: result.ok }).toEqual({ key, ok: false });
        }
      }
    }
  });
});

describe("nextState (throwing variant)", () => {
  test("returns target state on legal transition", () => {
    expect(nextState("DRAFT", "spec_approve")).toBe("APPROVED");
    expect(nextState("APPROVED", "spec_claim")).toBe("IN_PROGRESS");
    expect(nextState("IN_PROGRESS", "spec_close")).toBe("DONE");
    expect(nextState("DONE", "spec_reopen")).toBe("IN_PROGRESS");
    expect(nextState("BLOCKED", "spec_park")).toBe("PARKED");
  });

  test("throws on illegal transition", () => {
    expect(() => nextState("DRAFT", "spec_close")).toThrow("state_invalid");
    expect(() => nextState("DONE", "spec_block")).toThrow("state_invalid");
    expect(() => nextState("APPROVED", "spec_unblock")).toThrow("state_invalid");
  });

  test("DRAFT spec_claim throws without claimerIsAuthor", () => {
    expect(() => nextState("DRAFT", "spec_claim")).toThrow();
  });

  test("DRAFT spec_claim succeeds with claimerIsAuthor: true", () => {
    expect(nextState("DRAFT", "spec_claim", { claimerIsAuthor: true })).toBe("IN_PROGRESS");
  });
});

describe("ALL_STATES matches SPEC_STATES set", () => {
  test("test fixture state list mirrors runtime SPEC_STATES", () => {
    expect(new Set(ALL_STATES)).toEqual(SPEC_STATES);
  });
});
