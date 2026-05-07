import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { blockerLint, parseBlockers } from "../../src/lint/blockers.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

describe("parseBlockers", () => {
  test("returns null when HUMAN_BLOCKERS.md absent", () => {
    temp = makeTempRepo();
    expect(parseBlockers(temp.rootDir)).toBeNull();
  });

  test("parses single entry", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "HUMAN_BLOCKERS.md"),
      "# Blockers\n\n### 011900ZMAY26 — Vendor lib\n\nBody text\nfor the entry.\n",
    );
    const b = parseBlockers(temp.rootDir, new Date(Date.UTC(2026, 4, 8, 12, 0, 0)));
    expect(b).not.toBeNull();
    if (!b) return;
    expect(b.count).toBe(1);
    expect(b.entries[0]?.dtg).toBe("011900ZMAY26");
    expect(b.entries[0]?.title).toBe("Vendor lib");
    expect(b.entries[0]?.daysSinceUtc).toBe(6);
    expect(b.entries[0]?.isStub).toBe(false);
  });

  test("flags stub entries (empty body)", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "HUMAN_BLOCKERS.md"),
      "# B\n\n### 011900ZMAY26 — Empty\n\n### 020900ZMAY26 — Resolved one\n\nRESOLVED on 020900ZMAY26.\n",
    );
    const b = parseBlockers(temp.rootDir);
    if (!b) throw new Error("expected blockers");
    expect(b.entries[0]?.isStub).toBe(true);
    expect(b.entries[1]?.isStub).toBe(true);
  });

  test("extracts referenced spec slugs from body", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "HUMAN_BLOCKERS.md"),
      "# B\n\n### 011900ZMAY26 — X\n\nBlocked on fe-account-export and go-mcp-oauth landing.\n",
    );
    const b = parseBlockers(temp.rootDir);
    if (!b) throw new Error("expected blockers");
    const refs = b.entries[0]?.referencedSpecs ?? [];
    expect(refs).toContain("fe-account-export");
    expect(refs).toContain("go-mcp-oauth");
  });

  test("extracts slugs with any prefix, not just known ones", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "HUMAN_BLOCKERS.md"),
      "# B\n\n### 011900ZMAY26 — X\n\nBlocked on auth-service and sso-login landing.\n",
    );
    const b = parseBlockers(temp.rootDir);
    if (!b) throw new Error("expected blockers");
    const refs = b.entries[0]?.referencedSpecs ?? [];
    expect(refs).toContain("auth-service");
    expect(refs).toContain("sso-login");
  });
});

describe("blockerLint", () => {
  test("flags stale, stub, orphan", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "HUMAN_BLOCKERS.md"),
      `# B

### 011900ZMAY26 — Old vendor
Blocked on fe-account-export landing.

### 100900ZMAY26 — Empty stub

### 110900ZMAY26 — Orphan ref
Refs go-nonexistent.
`,
    );
    const b = parseBlockers(temp.rootDir, new Date(Date.UTC(2026, 4, 11, 12, 0, 0)));
    if (!b) throw new Error("expected blockers");
    const activeSlugs = new Set(["fe-account-export"]);
    const activeWithHuman = new Set<string>();
    const findings = blockerLint(b, {
      activeSlugs,
      activeSlugsWithOpenHuman: activeWithHuman,
    });
    const cats = findings.map((f) => f.category);
    expect(cats).toContain("blocker-stale");
    expect(cats).toContain("blocker-stub");
    expect(cats).toContain("blocker-orphan");
  });
});
