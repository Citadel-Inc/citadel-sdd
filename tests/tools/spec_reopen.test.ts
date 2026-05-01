import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specReopen } from "../../src/tools/spec_reopen.js";
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

describe("specReopen", () => {
  test("DONE -> IN_PROGRESS, mv done→active, splice index", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    const out = specReopen({ slug: "done", reason: "regression spotted" }, ctx());
    expect(out.before.state).toBe("DONE");
    expect(out.after.state).toBe("IN_PROGRESS");
    expect(existsSync(join(temp.rootDir, "specs", "active", "done"))).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "done", "done"))).toBe(false);
    const md = readFileSync(join(temp.rootDir, "specs", "active", "done", "spec.md"), "utf8");
    expect(md).toContain("IN_PROGRESS 011945ZMAY26 — reopened — regression spotted");
  });

  test("requires non-empty reason", () => {
    temp = makeTempRepo({ doneFixtures: ["done"] });
    expect(() => specReopen({ slug: "done", reason: "" }, ctx())).toThrow("reason_missing");
  });

  test("rejects from non-DONE state", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specReopen({ slug: "draft-minimal", reason: "x" }, ctx())).toThrow(
      "state_invalid",
    );
  });
});
