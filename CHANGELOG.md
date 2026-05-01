# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-v0.1.0 entries track PRD ratification and repo-hygiene scaffolding only — no published artifacts.

## [Unreleased]

### Added

- Repo-hygiene scaffold: `AGENTS.md`, `CLAUDE.md` (symlink), `CONTRIBUTING.md`, `HUMANS.md`, `SECURITY.md`, `CODEOWNERS`, `CHANGELOG.md`, `.gitignore`.

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
