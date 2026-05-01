# Contributing

Public OSS project (MIT). External PRs welcome. Process is the same as Rethunk-AI internal MCP repos.

## Prerequisites

- **Bun ≥ 1.3.11** — primary runtime + package manager.
- **Node.js ≥ 22** — runtime fallback for `npx` users.
- **Git ≥ 2.28**.

## Development setup

```bash
git clone https://github.com/Rethunk-AI/citadel-sdd.git
cd citadel-sdd
bun install
bun run build       # tsc → dist/
bun run check       # Biome lint + format check
bun run check:fix   # auto-fix with Biome
bun run test        # bun test src/
bun run test:coverage  # bun test src/ --coverage
```

(Build / test scripts land in Phase A — see [PRD § 11](PRD.md#11-build-sequence).)

## Git hooks

`bun run setup-hooks` (Phase A) sets `core.hooksPath = .githooks`.

| Hook | Runs |
|------|------|
| pre-commit | `bun run check` + `bun run test` |
| pre-push | frozen install + build + check + test (mirrors CI) |

Set `SKIP_GIT_HOOKS=1` to bypass.

## Commit conventions

```
type(scope): imperative summary ≤72 chars

Body explains WHY this change exists — motivation, context, constraints.
Not a file list. Not a summary of what the diff already shows.
```

| Type | When |
|------|------|
| `feat` | New capability |
| `fix` | Bug corrected |
| `docs` | Documentation only |
| `refactor` | No behaviour change |
| `test` | Test additions or fixes |
| `chore` | Maintenance, deps, tooling |
| `ci` | CI/CD config |
| `build` | Build system changes |
| `spec` | Reserved — citadel-sdd's own dogfood specs (when introduced) |

One logical unit per commit. Max ~7 files. Split by theme, not by file count.

## CI

GitHub Actions (Phase D):

1. `bun install --frozen-lockfile`
2. `bun run build`
3. `bun run check` (Biome)
4. `bun run test:coverage` + 80% line coverage threshold

Match CI steps locally before opening a PR.

### Citadel parity (off-CI, maintainer-only)

Citadel is a private repo and we do **not** trust GitHub-hosted runners with token access to it. Citadel-parity validation (run `spec_lint` against `Rethunk-Tech/citadel`'s live tree, expect exit-code parity with archived `spec-status.py --strict --include-done`) runs **locally on a maintainer's machine** before tagging v0.1.0. Public CI uses synthetic fixtures only.

## Pull request checklist

- [ ] `bun run build` passes.
- [ ] `bun run check` passes (no Biome errors).
- [ ] `bun run test` passes.
- [ ] Any new tool has a corresponding `*.test.ts` file.
- [ ] [PRD.md](PRD.md) tool table + [AGENTS.md](AGENTS.md) tool surface updated if public surface changed.
- [ ] [CHANGELOG.md](CHANGELOG.md) entry added under `[Unreleased]`.

## Adding a tool

1. Create `src/tools/<tool_name>.ts` exporting `register<ToolName>Tool(server)`.
2. Register in `src/mcp/tools.ts`.
3. Add JSONSchema input via Zod in `src/mcp/schemas.ts`.
4. Add test `src/tools/<tool_name>.test.ts`.
5. Update [PRD § 4](PRD.md#4-tool-inventory-16-tools) and [HUMANS.md](HUMANS.md) tool table.
6. Add [CHANGELOG.md](CHANGELOG.md) entry.

## Adding a profile

1. Create `src/profile/<name>.yaml`.
2. Set `extends:` if the profile inherits.
3. Add round-trip test in `tests/profile/`.
4. Document in [PRD § 3](PRD.md#3-profile-system) and [HUMANS.md](HUMANS.md).

## Code style

Enforced by **Biome** (`biome.json`): recommended rules, 100-char lines, double quotes, semicolons, trailing commas.

TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`. Avoid `any`; if genuinely necessary, add an inline comment explaining why.

## Reporting bugs / requesting features

GitHub Issues on `Rethunk-AI/citadel-sdd`. Security issues: see [SECURITY.md](SECURITY.md) — do **not** open public issues for vulnerabilities.
