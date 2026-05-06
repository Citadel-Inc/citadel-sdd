import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  README_UNPARSEABLE,
  upsertSpecReadmeRow,
  writeSpecReadmeFull,
} from "../../src/spec/spec_readme.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "spec-fixtures");

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

function repo(): { rootDir: string; specDir: string } {
  if (!temp) throw new Error("temp not set");
  return { rootDir: temp.rootDir, specDir: "specs" };
}

describe("spec_readme", () => {
  test("writeSpecReadmeFull replaces entire README from disk", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const r = repo();
    const path = join(r.rootDir, r.specDir, "README.md");
    writeFileSync(path, "# Specs\n\n## Notes\n\ntrailing\n");
    writeSpecReadmeFull(r);
    const md = readFileSync(path, "utf8");
    expect(md).toContain("## Active");
    expect(md).toContain("draft-minimal");
    expect(md).not.toContain("## Notes");
  });

  test("upsert replaces _(none)_ when first real spec appears in Active", () => {
    temp = makeTempRepo();
    const r = repo();
    const slug = "new-spec";
    const dst = join(r.rootDir, "specs", "active", slug);
    cpSync(join(FIXTURES_ROOT, "draft-minimal"), dst, { recursive: true });
    upsertSpecReadmeRow(r, slug);
    const md = readFileSync(join(r.rootDir, "specs", "README.md"), "utf8");
    const activeStart = md.indexOf("## Active");
    const doneStart = md.indexOf("## Done");
    const activeChunk = md.slice(activeStart, doneStart);
    expect(activeChunk).toContain(`| ${slug} |`);
    expect(activeChunk).not.toContain("| _(none)_ |");
  });

  test("upsert moves mutated slug to first data row in Active (in-place status)", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal", "approved-ratified"] });
    const r = repo();
    upsertSpecReadmeRow(r, "approved-ratified");
    const md = readFileSync(join(r.rootDir, "specs", "README.md"), "utf8");
    const activeStart = md.indexOf("## Active");
    const doneStart = md.indexOf("## Done");
    const activeChunk = md.slice(activeStart, doneStart);
    const sep = "|------|-------|-----|-------|";
    const i = activeChunk.indexOf(sep);
    expect(i).toBeGreaterThan(-1);
    const afterSep = activeChunk.slice(i + sep.length).trimStart();
    const firstLine = afterSep.split("\n")[0] ?? "";
    expect(firstLine).toMatch(/^\| approved-ratified \|/);
  });

  test("upsert preserves trailing content after Parked table", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const r = repo();
    const path = join(r.rootDir, "specs", "README.md");
    const base = readFileSync(path, "utf8");
    writeFileSync(path, `${base}\n## Notes\n\nkeep-me\n`, "utf8");
    upsertSpecReadmeRow(r, "draft-minimal");
    const md = readFileSync(path, "utf8");
    expect(md).toContain("keep-me");
    expect(md).toContain("## Notes");
  });

  test("upsert throws when README lacks machine table header", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const r = repo();
    writeFileSync(join(r.rootDir, "specs", "README.md"), "# Specs\n", "utf8");
    expect(() => upsertSpecReadmeRow(r, "draft-minimal")).toThrow(new RegExp(README_UNPARSEABLE));
  });

  test("upsert after removing last Active row restores placeholder in Active", () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const r = repo();
    const slug = "draft-minimal";
    const dir = join(r.rootDir, "specs", "active", slug);
    const doneDir = join(r.rootDir, "specs", "done", slug);
    renameSync(dir, doneDir);
    upsertSpecReadmeRow(r, slug);
    const md = readFileSync(join(r.rootDir, "specs", "README.md"), "utf8");
    expect(md).toContain("| _(none)_ | | | |");
    expect(md).toContain(`| ${slug} |`);
    const activeStart = md.indexOf("## Active");
    const doneStart = md.indexOf("## Done");
    const activeChunk = md.slice(activeStart, doneStart);
    expect(activeChunk).toContain("| _(none)_ | | | |");
  });
});
