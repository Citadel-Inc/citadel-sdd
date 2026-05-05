import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { sddDoctor } from "../../src/tools/sdd_doctor.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function ctx(): ToolContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, profile: resolveBuiltIn("default") };
}

describe("sddDoctor", () => {
  test("repairs missing parked/ directory", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    rmSync(join(temp.rootDir, "specs", "parked"), { recursive: true, force: true });
    const out = sddDoctor({}, ctx());
    expect(existsSync(join(temp.rootDir, "specs", "parked"))).toBe(true);
    expect(out.scaffold_repairs.length).toBeGreaterThan(0);
    expect(out.recommendations.some((r) => r.includes("Repaired missing spec bucket"))).toBe(true);
  });

  test("clean repo: no drift, inferred profile from extends", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal", "approved-ratified"] });
    const out = sddDoctor({}, ctx());
    expect(out.inferred_profile).toBe("default");
    expect(out.drift).toBe(false);
    expect(out.scaffold_repairs).toEqual([]);
  });

  test("empty repo recommends spec_init", () => {
    temp = makeTempRepo();
    const out = sddDoctor({}, ctx());
    expect(out.recommendations.some((r) => r.includes("spec_init"))).toBe(true);
  });

  test("status_drift surfaces in recommendations", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    writeFileSync(
      join(temp.rootDir, "specs", "active", "draft-minimal", "tasks.md"),
      "# T\n\n| | |\n|---|---|\n| Status | DONE 011900ZMAY26 |\n\n## P0\n\n- [ ] x\n",
    );
    const out = sddDoctor({}, ctx());
    expect(out.drift).toBe(true);
    expect(out.recommendations.some((r) => r.includes("status_drift"))).toBe(true);
  });

  test("infers bastion profile when extends:bastion declared", () => {
    temp = makeTempRepo();
    writeFileSync(join(temp.rootDir, "specs", "config.yaml"), "extends: bastion\n");
    const out = sddDoctor({}, ctx());
    expect(out.inferred_profile).toBe("bastion");
  });

  test("missing config.yaml recommends spec_init", () => {
    temp = makeTempRepo();
    const fs = require("node:fs") as typeof import("node:fs");
    fs.unlinkSync(join(temp.rootDir, "specs", "config.yaml"));
    const out = sddDoctor({}, ctx());
    expect(out.inferred_profile).toBe("unknown");
    expect(out.recommendations.some((r) => r.includes("spec_init"))).toBe(true);
  });
});
