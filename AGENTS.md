# AGENTS.md

LLM + dev orientation. **This file is intentionally thin** — it points at the canon files and lists the contract-change rules. Canon lives in `docs/` and the top-level role files.

## Status

`v0.4.0` — adds `specs/parked/`, `spec_park`, and `spec_lint.include_parked`.

## Canon pointers

| Topic | File |
|-------|------|
| Mission, scope (in/out), end-user quickstart, goal-oriented tool mapping | [HUMANS.md](HUMANS.md) |
| File layout, state machine, file-system contract, write invariants, tool taxonomy | [docs/architecture.md](docs/architecture.md) |
| Profile config schema, inheritance, slug uniqueness, shipped profile defaults | [docs/profile-system.md](docs/profile-system.md) |
| Per-tool inputs / outputs / failure modes | [docs/mcp-tools.md](docs/mcp-tools.md) |
| Architectural decision log (D-1, D-2, …) | [docs/decisions.md](docs/decisions.md) |
| Per-client wiring + from-source build | [docs/install.md](docs/install.md) |
| Dev setup, commit conventions, CI, testing strategy, promotion gate, PR checklist | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Threat model, V1 local-only design, vulnerability reporting | [SECURITY.md](SECURITY.md) |

## Contract-change rules

When you change a contract, update its canon location:

| Contract | Canon to update |
|----------|-----------------|
| Public tool surface (rename / add / remove) | [docs/mcp-tools.md](docs/mcp-tools.md) + [docs/architecture.md § Tool taxonomy](docs/architecture.md#tool-taxonomy) + [HUMANS.md](HUMANS.md) goal-table |
| Profile config schema | [docs/profile-system.md](docs/profile-system.md) |
| State machine | [docs/architecture.md § State machine](docs/architecture.md#state-machine) + transitions tests |
| File-system contract | [docs/architecture.md § File-system contract](docs/architecture.md#file-system-contract) + invariants checker |
| Promotion gate / versioning | [CONTRIBUTING.md § Promotion gate](CONTRIBUTING.md#promotion-gate) |
| Architectural decision | [docs/decisions.md](docs/decisions.md) — append, do not edit history |
