# PRD — `citadel-sdd` (transient design doc)

> **This file is transient.** It exists to capture origin retrospective, design rationale narrative, and build sequence during Phase A through Phase D. **Deleted at v0.1.0 tag.** Permanent canon lives in `docs/`, `AGENTS.md`, `HUMANS.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `README.md` — never point canon at this file.

| | |
|---|---|
| Status | Build-tracking; transient. |
| Authored | 011920ZMAY26. Ratified 011945ZMAY26. Restructured 012005ZMAY26 (canon migrated to permanent files). |
| Permanent canon entry points | [README.md](README.md), [AGENTS.md](AGENTS.md), [HUMANS.md](HUMANS.md), [docs/](docs/) |

---

## 1. Origin

Retrospective from a five-spec citadel session (2026-05-01) found:

- Per-spec ceremony averaged ~15 tool calls (status flips, ratify-table edits, README splices, `git mv`, close commits). Five specs ⇒ ~75 ceremony calls per session.
- The `specs/README.md` done-row was hand-authored each close as a wall-of-text summary; both error-prone and slow.
- `AskUserQuestion` ratify gates were boilerplate ("ratify all" yes/no) that the user always answered the same way; the gate had no value when spec defaults were explicit.
- Migration application was a recurring gap (Supabase MCP read-only, hand-shell to `supabase db push`); affected three specs with substrate changes during the session.
- Cwd persistence between Bash calls was misdocumented in `~/.claude/CLAUDE.md`, causing intermittent path failures.
- `mcp__rethunk-git__batch_commit` quietly swept untracked files into commits, mixing attribution.

The first three items are the direct fit for an MCP wrapper. The remaining items landed as global doctrine corrections in the same retrospective turn.

---

## 2. Design rationale

### Why TypeScript on Bun

All three sibling Rethunk MCP servers (`rethunk-github-mcp`, `rethunk-mcp-go`, `rethunk-mcp-ts`) are TypeScript on Bun. Adopting the same stack:

- Eliminates ecosystem fan-out for maintainers.
- Reuses MCP SDK + Biome + bun.lock conventions across the suite.
- Matches the consumer environment (Claude Code + Cursor + Zed clients all speak MCP fluently).

### Why MIT

Public OSS, commercial-friendly, no copyleft surface for downstream users. Aligns with `rethunk-github-mcp` precedent.

### Why `specs/config.yaml` (not `.sdd/`)

Single canonical path keeps consumer mental model simple. `specs/` is already the SDD home directory; co-locating config there means one folder to find for everything spec-related.

### Why slug uniqueness forever

Reusing a slug after `spec_close` would silently overwrite history when a closed spec's path got reincarnated. Hard rule prevents accidental overwrite; trades a tiny consumer cost (must invent a new slug for redo) for a large safety guarantee.

### Why the profile chain `default → bastion → citadel`

`bastion` features (DTG injection, IRONLAW callouts, militant commit voice) are useful in citadel but distracting / off-brand for public users. Profile inheritance lets one tool serve every audience without per-customer forks. Citadel as descendant of bastion (rather than parallel) means citadel inherits all bastion fixes automatically.

### Why off-CI citadel parity

Citadel is private. GitHub-hosted runners with token access to citadel are an attack surface (runner compromise, log leak, fork-PR hijack). Maintainer-run-only parity validation eliminates the surface entirely. Public CI uses synthetic fixtures only.

### Why transient PRD

A PRD is a design artifact for the *building* phase. Once a project is in steady-state maintenance, design canon becomes a liability — readers don't know whether a PRD reflects current reality or design-time intent. By making canon live in permanent role-specific files (`docs/architecture.md`, `docs/profile-system.md`, `docs/decisions.md`, `docs/mcp-tools.md`), we can delete this file at v0.1.0 with zero canon loss and zero broken references.

---

## 3. Build sequence

### Phase A — substrate

1. `package.json`, `tsconfig.json`, `biome.json`, `bun.lock`, MIT `LICENSE`.
2. `src/spec/parse.ts` + tests against synthetic fixture suite under `tests/spec-fixtures/`.
3. `src/spec/render.ts` + idempotency tests.
4. `src/spec/transitions.ts` + tests.
5. `src/profile/resolver.ts` + three shipped profile YAMLs.

### Phase B — tools

1. Read tools (`spec_list`, `spec_read`, `spec_status`, `spec_lint`, `sdd_doctor`).
2. Atomic write tools (`spec_approve`, `spec_ratify`, `spec_task_check`, `spec_task_add`, `spec_handoff`).
3. Composite write tools (`spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`).
4. `spec_index_rebuild`, `spec_init`.

### Phase C — MCP wiring

1. JSON-RPC server via `@modelcontextprotocol/sdk`.
2. Tool registration with Zod-derived JSONSchema.
3. `src/index.ts` entrypoint.
4. `scripts/install.sh` for `~/.claude/mcp_servers.json`.

### Phase D — close

1. Public CI green on synthetic-fixture suite.
2. Citadel `/spec-status` slash command rewired to MCP.
3. Citadel `CLAUDE.md` flips forward-pointer → live-tool.
4. Maintainer-run citadel-parity validation green on candidate commit.
5. Tag `v0.1.0` after promotion-gate criteria met (see [CONTRIBUTING.md § Promotion gate](CONTRIBUTING.md#promotion-gate)).
6. **Delete this file (`PRD.md`).** Verify zero broken cross-references via tree-wide grep.

---

## 4. Decision history

Decision values + dates are canonical in [docs/decisions.md](docs/decisions.md). The narrative-style rationale for each decision (the "why we ended up here") lives in § 2 above and in the commit log on `main` between session-start `5f277af` and PRD-restructure commit.

---

## 5. Author note (for the next agent)

This PRD was authored at 011920ZMAY26, ratified 011945ZMAY26, restructured 012005ZMAY26 to migrate canon out of this file into permanent role-specific files. The retrospective evidence behind § 1 lives in the citadel commit log between `b745e3e` (first claim of the originating session) and `2dffde3` (last close).

If any of the patterns in the canon files seem over-engineered relative to the citadel surface today: don't trust that instinct. Mechanical cost compounds with every spec; citadel's active backlog alone is N future claim/close cycles, and public users multiply that.

When Phase D step 6 deletes this file, the project's design history compresses into:
- The retrospective evidence in citadel's commit log (immutable).
- Permanent canon in `docs/`, top-level role files.
- This repo's own commit log (every decision references the docs/decisions.md entry it implements).

That is sufficient. A maintenance-phase reader does not need to read this file to understand the project; they need only the canon files. Hence its deletability.

NOTHING FURTHER.
