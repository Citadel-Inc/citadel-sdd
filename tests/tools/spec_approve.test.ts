import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { gitStatusPorcelain } from "../../src/spec/git.js";
import { specApprove } from "../../src/tools/spec_approve.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

const FIXED_DTG_CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0));

function ctx(profileName: "default" | "bastion" | "citadel" = "bastion"): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return {
    rootDir: temp.rootDir,
    profile: resolveBuiltIn(profileName),
    clock: FIXED_DTG_CLOCK,
  };
}

describe("specApprove", () => {
  test("DRAFT -> APPROVED writes both files + commits", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specApprove({ slug: "draft-minimal" }, ctx());
    expect(out.before.state).toBe("DRAFT");
    expect(out.after.state).toBe("APPROVED");
    expect(out.after.dtg).toBe("011945ZMAY26");
    expect(out.commit_sha).not.toBeNull();
    expect(out.dryRun).toBe(false);

    const specMd = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md"),
      "utf8",
    );
    expect(specMd).toContain("APPROVED 011945ZMAY26");

    const status = gitStatusPorcelain({ rootDir: temp.rootDir });
    expect(status).toEqual([]);
  });

  test("dryRun returns predicted state without writing", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specApprove({ slug: "draft-minimal", dryRun: true }, ctx());
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(out.after.state).toBe("APPROVED");

    const specMd = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md"),
      "utf8",
    );
    expect(specMd).toContain("DRAFT 011900ZMAY26");
  });

  test("commit:false leaves edits unstaged", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specApprove({ slug: "draft-minimal", commit: false }, ctx());
    expect(out.commit_sha).toBeNull();
    const status = gitStatusPorcelain({ rootDir: temp.rootDir });
    expect(status.length).toBeGreaterThan(0);
  });

  test("rejects spec_approve from APPROVED", () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    expect(() => specApprove({ slug: "approved-ratified" }, ctx())).toThrow("state_invalid");
  });

  test("rejects spec_approve from IN_PROGRESS", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    expect(() => specApprove({ slug: "in-progress-midway" }, ctx())).toThrow("state_invalid");
  });

  test("note attaches to status tail + commit subject (conventional profile)", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    specApprove({ slug: "draft-minimal", note: "scope locked" }, ctx());
    const specMd = readFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "spec.md"),
      "utf8",
    );
    expect(specMd).toContain("APPROVED 011945ZMAY26 — scope locked");
  });

  test("unknown slug throws", () => {
    temp = makeTempRepo();
    expect(() => specApprove({ slug: "missing" }, ctx())).toThrow("spec_not_found");
  });
});
