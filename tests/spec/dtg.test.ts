import { describe, expect, test } from "bun:test";
import { dtgToRecencySortKey, formatBastionDTG, formatDTG, nowDTG } from "../../src/spec/dtg.js";

describe("formatBastionDTG", () => {
  test("01 May 2026 19:45 UTC -> 011945ZMAY26", () => {
    const d = new Date(Date.UTC(2026, 4, 1, 19, 45, 0));
    expect(formatBastionDTG(d)).toBe("011945ZMAY26");
  });

  test("31 Dec 2025 23:59 UTC -> 312359ZDEC25", () => {
    const d = new Date(Date.UTC(2025, 11, 31, 23, 59, 0));
    expect(formatBastionDTG(d)).toBe("312359ZDEC25");
  });

  test("01 Jan 2030 00:00 UTC -> 010000ZJAN30", () => {
    const d = new Date(Date.UTC(2030, 0, 1, 0, 0, 0));
    expect(formatBastionDTG(d)).toBe("010000ZJAN30");
  });

  test("year 2100 wraps to two-digit '00'", () => {
    const d = new Date(Date.UTC(2100, 5, 15, 12, 0, 0));
    expect(formatBastionDTG(d)).toBe("151200ZJUN00");
  });
});

describe("formatDTG", () => {
  test("DDHHMMZMONYY format delegates to formatBastionDTG", () => {
    const d = new Date(Date.UTC(2026, 4, 1, 19, 45, 0));
    expect(formatDTG(d, "DDHHMMZMONYY")).toBe("011945ZMAY26");
  });

  test("ISO-8601 format returns toISOString output", () => {
    const d = new Date(Date.UTC(2026, 4, 1, 19, 45, 0));
    expect(formatDTG(d, "ISO-8601")).toBe("2026-05-01T19:45:00.000Z");
  });
});

describe("nowDTG", () => {
  test("uses injected clock", () => {
    const fixed = new Date(Date.UTC(2026, 4, 1, 19, 45, 0));
    expect(nowDTG("DDHHMMZMONYY", () => fixed)).toBe("011945ZMAY26");
    expect(nowDTG("ISO-8601", () => fixed)).toBe("2026-05-01T19:45:00.000Z");
  });

  test("default clock when none provided returns ISO-8601 parseable string", () => {
    const stamp = nowDTG("ISO-8601");
    expect(Number.isNaN(Date.parse(stamp))).toBe(false);
  });
});

describe("dtgToRecencySortKey", () => {
  test("parses Bastion DDHHMMZMONYY with two-digit-year epoch flip at yy >= 70", () => {
    expect(dtgToRecencySortKey("011945ZMAY26")).toBe(Date.UTC(2026, 4, 1, 19, 45));
    expect(dtgToRecencySortKey("011945ZMAY69")).toBe(Date.UTC(2069, 4, 1, 19, 45));
    expect(dtgToRecencySortKey("011945ZMAY70")).toBe(Date.UTC(1970, 4, 1, 19, 45));
  });

  test("falls through to Date.parse for ISO-8601 strings", () => {
    expect(dtgToRecencySortKey("2026-05-01T19:45:00Z")).toBe(Date.UTC(2026, 4, 1, 19, 45));
  });

  test("returns sentinel for empty, malformed Bastion, out-of-range, or unparseable inputs", () => {
    const sentinel = Number.NEGATIVE_INFINITY;
    for (const s of [
      "",
      "   ",
      "011945ZXXX26", // bogus month token
      "001945ZMAY26", // day 0
      "322400ZMAY26", // day 32 + hour 24
      "012460ZMAY26", // minute 60
      "not a dtg",
    ]) {
      expect(dtgToRecencySortKey(s)).toBe(sentinel);
    }
  });
});
