import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specPark } from "../../src/tools/spec_park.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0));

function ctx(profileName: "default" | "bastion" | "citadel" = "bastion"): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return {
    rootDir: temp.rootDir,
    profile: resolveBuiltIn(profileName),
    clock: CLOCK,
  };
}

describe("specPark", () => {
  test("requires non-empty resolution", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specPark({ slug: "draft-minimal", resolution: "" }, ctx())).toThrow(
      "resolution_missing",
    );
  });

  test("rejects spec not under active/", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    expect(() => specPark({ slug: "parked-minimal", resolution: "no-op" }, ctx())).toThrow(
      "spec_not_active",
    );
  });

  test("happy path parks DRAFT spec", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const out = specPark({ slug: "draft-minimal", resolution: "superseded by HTTPS MCP" }, ctx());
    expect(out.before.state).toBe("DRAFT");
    expect(out.after.state).toBe("PARKED");
    expect(out.after.path).toContain("parked");
    expect(out.commit_sha).not.toBeNull();

    const movedDir = join(temp.rootDir, "specs", "parked", "draft-minimal");
    expect(existsSync(movedDir)).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "active", "draft-minimal"))).toBe(false);

    const md = readFileSync(join(movedDir, "spec.md"), "utf8");
    expect(md).toContain("PARKED");
    expect(md).toContain("superseded by HTTPS MCP");

    const indexMd = readFileSync(join(temp.rootDir, "specs", "README.md"), "utf8");
    expect(indexMd).toContain("## Parked");
    expect(indexMd).toContain("draft-minimal");
  });
});
