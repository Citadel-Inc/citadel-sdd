<h1 align="center">citadel-sdd</h1>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version: 0.6.0](https://img.shields.io/badge/version-0.6.0-green.svg)](CHANGELOG.md)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-black.svg)](https://bun.sh)
[![Language: TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6.svg)](https://www.typescriptlang.org)
[![Repo: Rethunk-AI](https://img.shields.io/badge/repo-Rethunk--AI-blue.svg)](https://github.com/Rethunk-AI/citadel-sdd)

</div>

---

Agent workflows break down at the seams between lifecycle events — status flips, task-table updates, index rows, commit authoring, and `git mv` all have to happen together or the spec tree drifts. citadel-sdd collapses that work into one atomic MCP call per event, so a spec claim, close, or handoff is a single tool invocation rather than a coordinated sequence of ~15 hand-edits.

Under the hood it is a stdio MCP server built on Bun and TypeScript. Every mutating tool buffers writes in memory and either commits all of them or restores pre-call state — no partial updates reach disk. Invariants (spec.md status, tasks.md state, on-disk path, and the `specs/README.md` index) are checked and enforced on every write, making drift structurally impossible after a successful tool call.

The server ships two profiles out of the box (`default` and `bastion`) with profile inheritance, and is designed for three audiences: Citadel operators running private SDD workflows, Bastion agents that need deterministic lifecycle tooling, and public agent workflows that want a local-only, zero-telemetry spec engine under an MIT license.

## Highlights

- **20 MCP tools** covering every lifecycle event from DRAFT through DONE — and back via `spec_reopen` (DONE → IN_PROGRESS), `spec_unblock` (BLOCKED → IN_PROGRESS), and `spec_unpark` (PARKED → IN_PROGRESS).
- **Two shipped profiles** with inheritance: `default → bastion`.
- **Atomic by default** — all-or-nothing edits; failed mid-operation tools restore pre-call state.
- **Drift-impossible invariants** — `spec.md` status, `tasks.md` status, on-disk path, and `specs/README.md` index always agree after any tool's success.
- **Local-only** — no telemetry, no remote API, runs over MCP stdio.
- **MIT licensed**, public OSS.

## Documentation

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

## License

MIT — see [LICENSE](LICENSE).
