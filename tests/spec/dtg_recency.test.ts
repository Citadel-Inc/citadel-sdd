import { describe, expect, test } from "bun:test";
import { dtgToRecencySortKey } from "../../src/spec/dtg.js";

describe("dtgToRecencySortKey", () => {
  test("June sorts after May (lexicographic month token order differs)", () => {
    const endOfMay = dtgToRecencySortKey("311200ZMAY26");
    const startOfJune = dtgToRecencySortKey("011200ZJUN26");
    expect(startOfJune).toBeGreaterThan(endOfMay);
  });

  test("parses ISO-8601 timestamps", () => {
    const s = "2026-05-05T15:30:00.000Z";
    expect(dtgToRecencySortKey(s)).toBe(Date.parse(s));
  });

  test("empty or garbage sorts as unknown", () => {
    expect(dtgToRecencySortKey("")).toBe(Number.NEGATIVE_INFINITY);
    expect(dtgToRecencySortKey("not-a-date")).toBe(Number.NEGATIVE_INFINITY);
  });
});
