import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { ensureSpecBucketDirs } from "../../src/spec/scaffold.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

describe("ensureSpecBucketDirs", () => {
  test("no-op when specs root is absent", () => {
    temp = makeTempRepo();
    const root = join(temp.rootDir, "specs");
    rmSync(root, { recursive: true, force: true });
    const out = ensureSpecBucketDirs({ rootDir: temp.rootDir, specDir: "specs" });
    expect(out).toEqual([]);
  });

  test("creates missing bucket dirs with .gitkeep", () => {
    temp = makeTempRepo();
    const parked = join(temp.rootDir, "specs", "parked");
    rmSync(parked, { recursive: true, force: true });
    const out = ensureSpecBucketDirs({ rootDir: temp.rootDir, specDir: "specs" });
    expect(out.some((p) => p.endsWith("/parked"))).toBe(true);
    expect(existsSync(join(parked, ".gitkeep"))).toBe(true);
  });
});
