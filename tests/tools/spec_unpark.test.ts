import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specUnpark } from "../../src/tools/spec_unpark.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0));

function ctx(): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn("bastion"), clock: CLOCK };
}

describe("specUnpark", () => {
  test("requires non-empty resolution", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    expect(() => specUnpark({ slug: "parked-minimal", resolution: "" }, ctx())).toThrow(
      "resolution_missing",
    );
  });

  test("rejects spec not in PARKED", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specUnpark({ slug: "draft-minimal", resolution: "x" }, ctx())).toThrow(
      "state_invalid",
    );
  });

  test("happy path: PARKED -> IN_PROGRESS + git mv parked->active", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    const out = specUnpark(
      { slug: "parked-minimal", resolution: "trigger reached" },
      ctx(),
    );
    expect(out.before.state).toBe("PARKED");
    expect(out.after.state).toBe("IN_PROGRESS");
    expect(out.after.path).toContain("active");
    expect(out.commit_sha).not.toBeNull();

    const movedDir = join(temp.rootDir, "specs", "active", "parked-minimal");
    expect(existsSync(movedDir)).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "parked", "parked-minimal"))).toBe(false);

    const md = readFileSync(join(movedDir, "spec.md"), "utf8");
    expect(md).toContain("IN_PROGRESS 011945ZMAY26 — unparked — trigger reached");
  });

  test("dryRun: no filesystem mutation, no commit", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    const out = specUnpark(
      { slug: "parked-minimal", resolution: "trigger reached", dryRun: true },
      ctx(),
    );
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(existsSync(join(temp.rootDir, "specs", "parked", "parked-minimal"))).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "active", "parked-minimal"))).toBe(false);
  });
});
