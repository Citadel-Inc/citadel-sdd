# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-01

First public release. End-to-end SDD lifecycle wrapped as an MCP stdio server.

### Added

- **17 MCP tools** exposed over stdio (`@modelcontextprotocol/sdk` 1.x):
  - Read: `spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor`.
  - Atomic write: `spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff`.
  - Composite write: `spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`.
  - Infrastructure: `spec_index_rebuild`, `spec_init`.
- **Profile system** with extends-chain inheritance (`default → bastion → citadel`), config at `specs/config.yaml`. Cycle detection + Zod schema validation.
- **Substrate**: parser (frontmatter pipe-table + inline-fallback, Q-table, tasks `## P0/P1/P2`), renderer (idempotent round-trip), state machine (six transitions), DTG formatter (ISO-8601 / `DDHHMMZMONYY`), git wrappers, post-write invariants.
- **Repo-hygiene**: AGENTS.md / HUMANS.md / SECURITY.md / CONTRIBUTING.md, `docs/{architecture,profile-system,decisions,mcp-tools,install}.md`, GitHub Actions CI with phase-aware guards, issue + PR templates, install.sh.
- **Citadel-parity tool** (`bun run lint:citadel-parity`): exit-code parity with archived `spec-status.py --strict --include-done`. Maintainer-run only — never in CI per [D-19](docs/decisions.md).
- **204 tests** across 27 files; bun test runner.
- **Synthetic-fixture suite** under `tests/spec-fixtures/` covering all five lifecycle states plus edge cases.

### Notes

- All write tools support `dryRun: true`.
- Composite tools honor `commit_style` and `push_policy` from the resolved profile.
- Local-only V1; no remote API, no telemetry ([D-8](docs/decisions.md)).
- Slug uniqueness enforced forever; not configurable ([D-9](docs/decisions.md)).
- 20 architectural decisions logged in [docs/decisions.md](docs/decisions.md).
