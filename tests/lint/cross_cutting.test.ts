import { afterEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { crossCutting } from "../../src/lint/cross_cutting.js";
import type { RepoContext } from "../../src/spec/repo.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function repo(): RepoContext {
  if (!temp) throw new Error("temp repo not initialized");
  return { rootDir: temp.rootDir, specDir: "specs" };
}

describe("crossCutting", () => {
  test("ready-to-close fires when all checked + no human gates", () => {
    temp = makeTempRepo({ activeFixtures: ["done"] });
    const fs = require("node:fs") as typeof import("node:fs");
    fs.renameSync(
      join(temp.rootDir, "specs", "active", "done"),
      join(temp.rootDir, "specs", "active", "ready-spec"),
    );
    const findings = crossCutting(repo());
    const slugs = findings.filter((f) => f.category === "ready-to-close").map((f) => f.slug);
    expect(slugs).toContain("ready-spec");
  });

  test("not-indexed flags active spec missing from README", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    writeFileSync(
      join(temp.rootDir, "specs", "README.md"),
      "# Specs\n\n## Active\n\n| Slug | State |\n|------|-------|\n| other-spec | DRAFT |\n\n## Done\n\n",
    );
    const findings = crossCutting(repo());
    expect(findings.some((f) => f.category === "not-indexed" && f.slug === "draft-minimal")).toBe(
      true,
    );
  });

  test("orphan-indexed flags index entry without dir", () => {
    temp = makeTempRepo();
    writeFileSync(
      join(temp.rootDir, "specs", "README.md"),
      "# Specs\n\n## Active\n\n| Slug | State |\n|------|-------|\n| ghost | DRAFT |\n\n## Done\n\n",
    );
    const findings = crossCutting(repo());
    expect(findings.some((f) => f.category === "orphan-indexed" && f.slug === "ghost")).toBe(true);
  });

  test("human-uncrossed flags spec with [HUMAN] gate not in HUMAN_BLOCKERS.md", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    writeFileSync(join(temp.rootDir, "HUMAN_BLOCKERS.md"), "# blockers\n\n(none yet)\n");
    const findings = crossCutting(repo());
    expect(
      findings.some((f) => f.category === "human-uncrossed" && f.slug === "draft-minimal"),
    ).toBe(true);
  });

  test("orphan-parked flags spec on disk missing from README Parked table", () => {
    temp = makeTempRepo({ parkedFixtures: ["parked-minimal"] });
    writeFileSync(
      join(temp.rootDir, "specs", "README.md"),
      "# Specs\n\n## Active\n\n| Slug | State |\n|------|-------|\n\n## Done\n\n## Parked\n\n| Slug | DTG | Note |\n|------|-----|------|\n",
    );
    const findings = crossCutting(repo());
    expect(
      findings.some((f) => f.category === "orphan-parked" && f.slug === "parked-minimal"),
    ).toBe(true);
  });

  test("clean repo with empty index emits zero parity findings", () => {
    temp = makeTempRepo();
    const findings = crossCutting(repo()).filter(
      (f) => f.category === "not-indexed" || f.category === "orphan-indexed",
    );
    expect(findings).toEqual([]);
  });
});
