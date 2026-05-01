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

(Build / test scripts land in Phase A.)

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

GitHub Actions runs on PRs and pushes to `main`:

1. `bun install --frozen-lockfile`
2. `bun run build`
3. `bun run check` (Biome)
4. `bun run test:coverage` + 80% line coverage threshold

Match CI steps locally before opening a PR.

The CI workflow uses a phase-detect guard (`hashFiles('package.json')`) so pre-Phase-A pushes hit no-op skip steps.

## Testing strategy

### Synthetic-fixture suite (public CI)

Hand-authored fixture specs under `tests/spec-fixtures/` cover every state, transition, Q-table shape, and lint-rule trigger. Public CI runs these only — no private-repo content vendored, no network dependency, no credential plumbing ([D-18](docs/decisions.md), [D-19](docs/decisions.md)).

Test categories:

- **Unit:** parser round-trips on every fixture; render-then-parse idempotency.
- **Integration:** spin temp git repo from fixtures; run each tool end-to-end; assert tree + commit log shape.
- **Profile parity:** every shipped profile (`default`, `bastion`, `citadel`) round-trips through full lifecycle on a fixture repo.
- **Lint parity (synthetic):** TS port matches archived Python `spec-status.py --strict --include-done` exit-code-wise on the fixture suite.

### Citadel parity (off-CI, maintainer-only)

Citadel is private; GitHub-hosted runners are not trusted with credentials. Maintainer runs locally before tagging v0.1.0:

```bash
# on maintainer machine, with citadel checkout adjacent
bun run lint:citadel-parity --citadel ../citadel
```

Expects exit-code parity with archived `spec-status.py --strict --include-done` against the live citadel tree.

## Promotion gate

`v0.0.x` → `v0.1.0` requires:

1. Synthetic-fixture suite green on **7 consecutive commits**.
2. Maintainer-run citadel-parity green on the candidate commit.

Both must hold; either failure blocks the tag.

## Pull request checklist

- [ ] `bun run build` passes.
- [ ] `bun run check` passes (no Biome errors).
- [ ] `bun run test` passes.
- [ ] Any new tool has a corresponding `*.test.ts` file.
- [ ] Contract changes hit their canon location per [AGENTS.md "Contract-change rules"](AGENTS.md#contract-change-rules).

## Adding a tool

1. Create `src/tools/<tool_name>.ts` exporting `register<ToolName>Tool(server)`.
2. Register in `src/mcp/tools.ts`.
3. Add JSONSchema input via Zod in `src/mcp/schemas.ts`.
4. Add test `src/tools/<tool_name>.test.ts`.
5. Update [docs/mcp-tools.md](docs/mcp-tools.md), [docs/architecture.md § Tool taxonomy](docs/architecture.md#tool-taxonomy), and [HUMANS.md](HUMANS.md) goal-table.

## Adding a profile

1. Create `src/profile/<name>.yaml`.
2. Set `extends:` if the profile inherits.
3. Add round-trip test in `tests/profile/`.
4. Update [docs/profile-system.md](docs/profile-system.md).

## Adding an architectural decision

Append to [docs/decisions.md](docs/decisions.md). Do not edit prior entries.

## Code style

Enforced by **Biome** (`biome.json`): recommended rules, 100-char lines, double quotes, semicolons, trailing commas.

TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`. Avoid `any`; if genuinely necessary, add an inline comment explaining why.

## Reporting bugs / requesting features

GitHub Issues on `Rethunk-AI/citadel-sdd`. Security issues: see [SECURITY.md](SECURITY.md) — do **not** open public issues for vulnerabilities.
