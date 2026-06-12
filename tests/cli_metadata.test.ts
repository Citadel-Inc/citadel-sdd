import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  formatCliHelp,
  formatCliVersion,
  handleCliMetadataArgs,
  isCliEntryPoint,
} from "../src/index.js";

const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
  version: string;
};

describe("CLI metadata", () => {
  test("formats the package version", () => {
    expect(formatCliVersion()).toBe(packageJson.version);
  });

  test("formats help text", () => {
    expect(formatCliHelp()).toContain("Usage:");
    expect(formatCliHelp()).toContain("citadel-sdd");
  });

  test("handles metadata args before MCP startup", () => {
    const output: string[] = [];

    expect(handleCliMetadataArgs(["--version"], (message) => output.push(message))).toBe(true);
    expect(output).toEqual([packageJson.version]);
  });

  test("detects npm bin symlinks as CLI entry points", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "citadel-sdd-bin-"));
    const target = resolve(tempDir, "dist-index.js");
    const link = resolve(tempDir, "citadel-sdd");

    writeFileSync(target, "");
    symlinkSync(target, link);

    expect(isCliEntryPoint(link, target)).toBe(true);
  });
});
