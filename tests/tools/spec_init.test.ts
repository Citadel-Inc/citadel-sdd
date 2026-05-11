import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import { specInit } from "../../src/tools/spec_init.js";
import type { ToolContext } from "../../src/tools/types.js";

let workdir = "";

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), "citadel-sdd-init-"));
  execSync(`git -C ${workdir} init --initial-branch=main`, { stdio: "ignore" });
  execSync(`git -C ${workdir} config user.name "Test"`);
  execSync(`git -C ${workdir} config user.email "t@example.com"`);
  execSync(`git -C ${workdir} commit --allow-empty -m initial`);
});

afterEach(() => {
  if (workdir) rmSync(workdir, { recursive: true, force: true });
});

function ctx(): ToolContext {
  return { rootDir: workdir, profile: resolveBuiltIn("default") };
}

describe("specInit", () => {
  test("bootstraps with default profile", () => {
    const out = specInit({ profile: "default" }, ctx());
    expect(out.profile_resolved).toBe("default");
    expect(out.commit_sha).not.toBeNull();
    expect(existsSync(join(workdir, "specs", "config.yaml"))).toBe(true);
    expect(existsSync(join(workdir, "specs", "README.md"))).toBe(true);
    expect(existsSync(join(workdir, "specs", "active", ".gitkeep"))).toBe(true);
    expect(existsSync(join(workdir, "specs", "parked", ".gitkeep"))).toBe(true);

    const readme = readFileSync(join(workdir, "specs", "README.md"), "utf8");
    expect(readme).toContain("github.com/Rethunk-AI/citadel-sdd");

    const config = readFileSync(join(workdir, "specs", "config.yaml"), "utf8");
    expect(config).toContain("extends: default");
  });

  test("bastion profile", () => {
    specInit({ profile: "bastion" }, ctx());
    const config = readFileSync(join(workdir, "specs", "config.yaml"), "utf8");
    expect(config).toContain("extends: bastion");
  });

  test("overrides serialize alongside extends", () => {
    specInit(
      {
        profile: "default",
        overrides: { push_policy: "always" },
      },
      ctx(),
    );
    const config = readFileSync(join(workdir, "specs", "config.yaml"), "utf8");
    expect(config).toContain("extends: default");
    expect(config).toContain("push_policy: always");
  });

  test("dryRun no write", () => {
    const out = specInit({ profile: "default", dryRun: true }, ctx());
    expect(out.dryRun).toBe(true);
    expect(out.commit_sha).toBeNull();
    expect(existsSync(join(workdir, "specs"))).toBe(false);
  });

  test("rejects when specs/ already populated", () => {
    specInit({ profile: "default" }, ctx());
    expect(() => specInit({ profile: "bastion" }, ctx())).toThrow("specs_already_populated");
  });

  test("rejects when specs/ has stray content (subdir with file OR top-level file)", () => {
    mkdirSync(join(workdir, "specs", "active"), { recursive: true });
    writeFileSync(join(workdir, "specs", "active", "leftover.md"), "x");
    expect(() => specInit({ profile: "default" }, ctx())).toThrow("specs_already_populated");
    rmSync(join(workdir, "specs"), { recursive: true, force: true });

    mkdirSync(join(workdir, "specs"), { recursive: true });
    writeFileSync(join(workdir, "specs", "stray.txt"), "x");
    expect(() => specInit({ profile: "default" }, ctx())).toThrow("specs_already_populated");
  });
});
