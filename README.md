# citadel-sdd

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version: 0.2.0](https://img.shields.io/badge/version-0.2.0-green.svg)](CHANGELOG.md)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black.svg)](https://bun.sh)
[![Language: TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org)
[![Repo: Rethunk-AI](https://img.shields.io/badge/repo-Rethunk--AI-blue.svg)](https://github.com/Rethunk-AI/citadel-sdd)

MCP server wrapping the **Spec-Driven Development** lifecycle. One atomic MCP call replaces ~15 hand-edits per spec claim / close cycle. Built for Bastion, Citadel operators, Citadel customers, and public agent workflows.

## Highlights

- **19 MCP tools** + 1 diagnostic, covering every lifecycle event from DRAFT through DONE — and back via `spec_reopen` (DONE → IN_PROGRESS), `spec_unblock` (BLOCKED → IN_PROGRESS), and `spec_unpark` (PARKED → IN_PROGRESS).
- **Three shipped profiles** with inheritance: `default → bastion → citadel`.
- **Atomic by default** — all-or-nothing edits; failed mid-operation tools restore pre-call state.
- **Drift-impossible invariants** — `spec.md` status, `tasks.md` status, on-disk path, and `specs/README.md` index always agree after any tool's success.
- **Local-only** — no telemetry, no remote API, runs over MCP stdio.
- **MIT licensed**, public OSS.

## Where to go

| You are… | Start here |
|----------|------------|
| An agent / LLM working in this repo | [AGENTS.md](AGENTS.md) |
| Installing as a user | [HUMANS.md](HUMANS.md) → [docs/install.md](docs/install.md) |
| Looking up a tool's schema | [docs/mcp-tools.md](docs/mcp-tools.md) |
| Looking up file layout, state machine, FS contract | [docs/architecture.md](docs/architecture.md) |
| Looking up profile config | [docs/profile-system.md](docs/profile-system.md) |
| Reading architectural decisions | [docs/decisions.md](docs/decisions.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Reporting a vulnerability | [SECURITY.md](SECURITY.md) |
