# HUMANS.md — User guide

MCP server wrapping **Spec-Driven Development** lifecycle for Bastion, Citadel operators, Citadel customers, and public agent workflows.

## Mission

Drop the ~15 mechanical tool calls per spec claim/close cycle (status flips, decision-log ratify, tasks.md sync, `git mv` active→done, targeted `specs/README.md` index rows, conventional-commit authoring) into **one atomic MCP call per lifecycle event**.

## Scope

**In:** spec lifecycle (claim, approve, close, park, reopen, block, unblock, ratify, handoff, task ops, lint, init, doctor), profile system (`default → bastion → citadel`), TS port of archived `spec-status.py`.

**Out:** GitHub/GitLab API, spec authoring AI, multi-repo coordination, Q-table reasoning, CI/deploy hooks, web UI, telemetry.

## Quickstart

Install per [docs/install.md](docs/install.md). Then in your project:

```bash
# (via your MCP client) call: spec_init({ profile: "default" })
```

Yields:

```
specs/
├── config.yaml
├── README.md
├── active/.gitkeep
├── done/.gitkeep
└── parked/.gitkeep
```

Choose a different profile by editing `specs/config.yaml`. See [docs/profile-system.md](docs/profile-system.md).

## Common operations

Goal-oriented tool mapping. Per-tool schemas in [docs/mcp-tools.md](docs/mcp-tools.md).

| Goal | Tool |
|------|------|
| List specs | `spec_list` |
| Read spec + plan + tasks | `spec_read` |
| Single-spec status summary | `spec_status` |
| Lint spec tree | `spec_lint` |
| Diagnose existing repo | `sdd_doctor` |
| Approve a draft | `spec_approve` |
| Ratify Q-table TBD rows | `spec_ratify` |
| Flip a tasks.md checkbox | `spec_task_check` |
| Add a tasks.md item | `spec_task_add` |
| Reassign owner | `spec_handoff` |
| Claim (DRAFT/APPROVED → IN_PROGRESS) | `spec_claim` |
| Close (IN_PROGRESS → DONE; also PARKED → DONE to abandon) | `spec_close` |
| Park (hold pending trigger — → PARKED) | `spec_park` |
| Unpark (wake trigger fired — PARKED → IN_PROGRESS) | `spec_unpark` |
| Reopen (DONE → IN_PROGRESS) | `spec_reopen` |
| Block / unblock | `spec_block` / `spec_unblock` |
| Regenerate `specs/README.md` | `spec_index_rebuild` |
| Bootstrap fresh repo | `spec_init` |

All write tools support `dryRun: true` for preview.

Tools automatically target the active MCP workspace root. In multi-root clients, pass `rootIndex` or `workspaceRoot` to select a different project; environment variables are only a fallback for clients without MCP roots support.

## Publishing

### GitHub (automated) — version tags only

Pushing a semver tag `vX.Y.Z` that **exactly matches** `version` in `package.json` runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it asserts the tag/version match, builds, lint-checks, and tests, then:

1. `npm pack` using the committed `package.json` name `@rethunk/citadel-sdd` — the tarball is attached to a **GitHub Release** for that tag.
2. **GitHub Packages** (npm registry): the workflow rewrites the name to `@rethunk-ai/citadel-sdd` (the scope GitHub Packages requires for org `Rethunk-AI`) and runs `npm publish` to `https://npm.pkg.github.com` with the automatic `GITHUB_TOKEN`.

No repository secrets beyond the built-in `GITHUB_TOKEN` are required.

### npmjs (manual) — maintainers only

The public npmjs package `@rethunk/citadel-sdd` is published by hand:

1. On a clean checkout at the release commit: `bun install --frozen-lockfile`.
2. `npm login` so `npm whoami` shows the account that owns the `@rethunk` scope on npmjs.
3. Confirm `package.json` has `"name": "@rethunk/citadel-sdd"` and `publishConfig.access` is `"public"`.
4. `npm publish` — the `prepublishOnly` script first runs `build`, `check`, and `test`; publish aborts if any fail.

Publish the same `version` the `vX.Y.Z` tag points at, so npmjs and GitHub Packages stay in step.

## Where to go next

- Install detail → [docs/install.md](docs/install.md)
- Per-tool schemas → [docs/mcp-tools.md](docs/mcp-tools.md)
- Profile system reference → [docs/profile-system.md](docs/profile-system.md)
- Security / vulnerability reporting → [SECURITY.md](SECURITY.md)
- Contributing → [CONTRIBUTING.md](CONTRIBUTING.md)
