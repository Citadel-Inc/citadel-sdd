import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specClose } from "../../src/tools/spec_close.js";
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

describe("specClose", () => {
  test("requires non-empty summary", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    expect(() => specClose({ slug: "in-progress-midway", summary: "" }, ctx())).toThrow(
      "summary_missing",
    );
  });

  test("rejects when P0/P1/P2 have unchecked items without allow_open", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    expect(() => specClose({ slug: "in-progress-midway", summary: "done" }, ctx())).toThrow(
      "tasks_open",
    );
  });

  test("happy path closes from a fully-checked spec", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const fs = require("node:fs") as typeof import("node:fs");
    const tasksPath = join(temp.rootDir, "specs", "active", "in-progress-midway", "tasks.md");
    fs.writeFileSync(
      tasksPath,
      `# T

| | |
|---|---|
| Status | IN_PROGRESS 011920ZMAY26 |

## P0

- [x] all done

## P1

- [x] also done

## P2

- [x] complete
`,
    );
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fix`);

    const out = specClose({ slug: "in-progress-midway", summary: "implementation landed" }, ctx());
    expect(out.before.state).toBe("IN_PROGRESS");
    expect(out.after.state).toBe("DONE");
    expect(out.after.path).toContain("done");
    expect(out.commit_sha).not.toBeNull();
    expect(out.pushed).toBe(false);

    const movedDir = join(temp.rootDir, "specs", "done", "in-progress-midway");
    expect(existsSync(movedDir)).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "active", "in-progress-midway"))).toBe(false);

    const md = readFileSync(join(movedDir, "spec.md"), "utf8");
    expect(md).toContain("DONE 011945ZMAY26 — implementation landed");

    const indexMd = readFileSync(join(temp.rootDir, "specs", "README.md"), "utf8");
    expect(indexMd).toContain("in-progress-midway");
  });

  test("allow_open=[P2] permits open P2 items", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const fs = require("node:fs") as typeof import("node:fs");
    const tasksPath = join(temp.rootDir, "specs", "active", "in-progress-midway", "tasks.md");
    fs.writeFileSync(
      tasksPath,
      `# T

| | |
|---|---|
| Status | IN_PROGRESS 011920ZMAY26 |

## P0

- [x] done

## P1

- [x] done

## P2

- [ ] later
`,
    );
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fix`);
    const out = specClose(
      {
        slug: "in-progress-midway",
        summary: "ship now, P2 follow-up",
        allow_open: ["P2"],
      },
      ctx(),
    );
    expect(out.after.state).toBe("DONE");
  });

  test("rejects from non-IN_PROGRESS state", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    expect(() => specClose({ slug: "draft-minimal", summary: "x" }, ctx())).toThrow(
      "state_invalid",
    );
  });

  test("dryRun no write, no mv", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(
      join(temp.rootDir, "specs", "active", "in-progress-midway", "tasks.md"),
      `# T

| | |
|---|---|
| Status | IN_PROGRESS 011920ZMAY26 |

## P0

- [x] done

## P1

- [x] done

## P2

- [x] done
`,
    );
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fix`);

    const out = specClose({ slug: "in-progress-midway", summary: "x", dryRun: true }, ctx());
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(existsSync(join(temp.rootDir, "specs", "active", "in-progress-midway"))).toBe(true);
    expect(existsSync(join(temp.rootDir, "specs", "done", "in-progress-midway"))).toBe(false);
  });

  test("commit rejects unrelated dirty files", () => {
    temp = makeTempRepo({ activeFixtures: ["in-progress-midway"] });
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(
      join(temp.rootDir, "specs", "active", "in-progress-midway", "tasks.md"),
      `# T

| | |
|---|---|
| Status | IN_PROGRESS 011920ZMAY26 |

## P0

- [x] done

## P1

- [x] done

## P2

- [x] done
`,
    );
    execSync(`git -C ${temp.rootDir} add -A && git -C ${temp.rootDir} commit -m fix`);
    writeFileSync(join(temp.rootDir, "extra.txt"), "dirty");
    expect(() =>
      specClose({ slug: "in-progress-midway", summary: "implementation landed" }, ctx()),
    ).toThrow("working_tree_dirty");
  });
});
