# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-v0.1.0 entries track PRD ratification and repo-hygiene scaffolding only — no published artifacts.

## [Unreleased]

### Added

- Repo-hygiene scaffold: `AGENTS.md`, `CLAUDE.md` (symlink), `CONTRIBUTING.md`, `HUMANS.md`, `SECURITY.md`, `CODEOWNERS`, `CHANGELOG.md`, `.gitignore`.
- `.github/workflows/ci.yml` with phase-aware guards (no-op pre-Phase-A; activates on `package.json` presence).
- `.github/ISSUE_TEMPLATE/` (bug + feature YAML forms, security-routing config) and `.github/PULL_REQUEST_TEMPLATE.md` with contract-impact checklist.
- `docs/install.md` + `docs/mcp-tools.md` Phase-D placeholders delegating canon to `PRD.md`.

### Changed

- **CI scope ratified 011958ZMAY26:** citadel-parity job removed from public CI. Citadel is private; GitHub-hosted runners not trusted with credentials. Parity validation now runs locally on a maintainer's machine before v0.1.0 tag. Public CI runs synthetic-fixture suite only. Promotion gate updated across `PRD.md`, `AGENTS.md`, `CONTRIBUTING.md`, `HUMANS.md`, `README.md`.
- Synthetic-only test-fixture sourcing ratified (option **b** of three considered). Synthetic fixtures hand-authored under `tests/spec-fixtures/` (Phase A onward).

## [0.0.1] — 2026-05-01

### Added

- `PRD.md` — Spec-Driven Development MCP server design ratified by NOMAD `011945ZMAY26`. 16 tools + 1 diagnostic, profile system (`default → bastion → citadel`), TypeScript on Bun, MIT license.
- `LICENSE` — MIT.
- `README.md` — orientation pointer to PRD.

### Decisions ratified

- Language: TypeScript on Bun (matches `rethunk-github-mcp`, `rethunk-mcp-go`, `rethunk-mcp-ts`).
- License: MIT.
- Config location: `specs/config.yaml` (canonical; no `.sdd/` directory).
- Slug uniqueness: enforced forever; not configurable.
- Versioning: semver from `v0.0.x`; promote to `v0.1.0` on first citadel-parity green.
- Telemetry: zero.
- Tool roster: cut `spec_status_set` + `spec_diff_summary`; added `spec_approve`, `spec_init`, `sdd_doctor`.
