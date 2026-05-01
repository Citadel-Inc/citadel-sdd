import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/load.js";

let workdir = "";

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "citadel-sdd-config-"));
  mkdirSync(join(workdir, "specs"), { recursive: true });
});

afterEach(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  test("loads minimal extends:default", () => {
    writeFileSync(join(workdir, "specs", "config.yaml"), "extends: default\n");
    const p = loadConfig({ rootDir: workdir });
    expect(p.dtg_format).toBe("ISO-8601");
    expect(p.commit_style).toBe("freeform");
  });

  test("loads extends:citadel and matches built-in", () => {
    writeFileSync(join(workdir, "specs", "config.yaml"), "extends: citadel\n");
    const p = loadConfig({ rootDir: workdir });
    expect(p.push_policy).toBe("on_close");
    expect(p.dtg_format).toBe("DDHHMMZMONYY");
  });

  test("override on top of extends:bastion", () => {
    writeFileSync(join(workdir, "specs", "config.yaml"), "extends: bastion\npush_policy: always\n");
    const p = loadConfig({ rootDir: workdir });
    expect(p.push_policy).toBe("always");
    expect(p.commit_style).toBe("conventional");
  });

  test("missing config.yaml yields config_missing", () => {
    expect(() => loadConfig({ rootDir: workdir })).toThrow("config_missing");
  });

  test("malformed YAML yields config_invalid", () => {
    writeFileSync(join(workdir, "specs", "config.yaml"), "extends:\n  - this\n  - is array\n");
    expect(() => loadConfig({ rootDir: workdir })).toThrow();
  });

  test("YAML scalar at top level rejected", () => {
    writeFileSync(join(workdir, "specs", "config.yaml"), "just-a-string\n");
    expect(() => loadConfig({ rootDir: workdir })).toThrow("config_invalid");
  });
});
