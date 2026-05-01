import { describe, expect, test } from "bun:test";
import { formatBastionDTG, formatDTG, nowDTG } from "../../src/spec/dtg.js";

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
});
