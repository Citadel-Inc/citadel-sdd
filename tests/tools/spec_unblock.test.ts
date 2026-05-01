import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specUnblock } from "../../src/tools/spec_unblock.js";
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

describe("specUnblock", () => {
  test("BLOCKED -> IN_PROGRESS, removes ## Blocking", () => {
    temp = makeTempRepo({ activeFixtures: ["blocked-reason"] });
    const out = specUnblock({ slug: "blocked-reason", resolution: "vendor v1.0 published" }, ctx());
    expect(out.before.state).toBe("BLOCKED");
    expect(out.after.state).toBe("IN_PROGRESS");
    const md = readFileSync(
      join(temp.rootDir, "specs", "active", "blocked-reason", "spec.md"),
      "utf8",
    );
    expect(md).toContain("IN_PROGRESS 011945ZMAY26 — unblocked — vendor v1.0 published");
    expect(md).not.toContain("## Blocking");
  });

  test("requires resolution", () => {
    temp = makeTempRepo({ activeFixtures: ["blocked-reason"] });
    expect(() => specUnblock({ slug: "blocked-reason", resolution: "" }, ctx())).toThrow(
      "resolution_missing",
    );
  });

  test("rejects from non-BLOCKED state", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specUnblock({ slug: "draft-minimal", resolution: "x" }, ctx())).toThrow(
      "state_invalid",
    );
  });
});
