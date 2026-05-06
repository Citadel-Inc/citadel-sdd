#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config/load.js";
import { specLint } from "../src/tools/spec_lint.js";
import type { ToolContext } from "../src/tools/types.js";

const PYTHON_LINT_DEFAULT = `${process.env.HOME ?? ""}/.claude/skills/spec-status/scripts/spec-status.py`;

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function fail(message: string): never {
  process.stderr.write(`citadel-parity: ${message}\n`);
  process.exit(2);
}

const citadelArg =
  arg("citadel") ?? process.env.CITADEL_PARITY_ROOT ?? "../citadel";
const citadelRoot = resolve(citadelArg);
const pythonLint = arg("python-lint") ?? PYTHON_LINT_DEFAULT;

if (!existsSync(citadelRoot)) {
  fail(`citadel checkout not found: ${citadelRoot}`);
}
if (!existsSync(`${citadelRoot}/specs/active`)) {
  fail(`no specs/active in ${citadelRoot}; not a citadel repo`);
}

process.stdout.write(`citadel-parity: rootDir=${citadelRoot}\n`);

let profile;
try {
  profile = loadConfig({ rootDir: citadelRoot });
} catch (e) {
  fail(`could not load profile from ${citadelRoot}/specs/config.yaml: ${(e as Error).message}`);
}

const ctx: ToolContext = {
  rootDir: citadelRoot,
  profile,
};

const ours = specLint({ include_done: true }, ctx);
process.stdout.write(`our exit_code: ${ours.exit_code}\n`);
process.stdout.write(`our findings: ${ours.findings.length}\n`);
const errors = ours.findings.filter((f) => f.severity === "error");
const warnings = ours.findings.filter((f) => f.severity === "warning");
const infos = ours.findings.filter((f) => f.severity === "info");
process.stdout.write(
  `  errors=${errors.length}, warnings=${warnings.length}, info=${infos.length}\n`,
);

if (errors.length > 0) {
  process.stdout.write("\n--- ERROR FINDINGS ---\n");
  for (const f of errors.slice(0, 20)) {
    process.stdout.write(`  [${f.code}] ${f.slug ?? "?"}: ${f.message}\n`);
  }
  if (errors.length > 20) {
    process.stdout.write(`  ... +${errors.length - 20} more\n`);
  }
}

if (!existsSync(pythonLint)) {
  process.stderr.write(
    `\nPython reference script not found at ${pythonLint}; skipping cross-check.\n`,
  );
  process.exit(ours.exit_code);
}

let pythonExit = 0;
try {
  execFileSync("python3", [pythonLint, "--strict", "--include-done"], {
    cwd: citadelRoot,
    stdio: "ignore",
  });
} catch (e) {
  const status = (e as { status?: number }).status;
  pythonExit = typeof status === "number" ? status : 1;
}

process.stdout.write(`\npython exit_code: ${pythonExit}\n`);

if (ours.exit_code === pythonExit) {
  process.stdout.write(`\nPARITY: PASS (both exit ${ours.exit_code})\n`);
  process.exit(0);
}

process.stdout.write(
  `\nPARITY: FAIL (ours=${ours.exit_code}, python=${pythonExit})\n`,
);
process.exit(1);
