# Security Policy

## Reporting Security Vulnerabilities

**DO NOT** open a public GitHub issue for security vulnerabilities. Report them responsibly to:

**Email:** security@rethunk.tech
**Response SLA:** Initial response within 24 hours.

When reporting, please include:
- Description of the vulnerability
- Affected component(s) and version(s)
- Steps to reproduce (if applicable)
- Potential impact
- Suggested fix (optional)

## Scope & Risk Profile

`citadel-sdd` is an MCP server that performs **local file-system writes and git commits** within the consuming repository. It does **not** speak to any remote API in v1.

### File-System Write Risk
- **Medium:** Tools edit `specs/active/*`, `specs/done/*`, `specs/parked/*`, and `specs/README.md`.
- All writes are scoped to the repo's `specs/` tree. The server refuses operations on paths outside `git rev-parse --show-toplevel`.
- `HUMAN_BLOCKERS.md` is read by lint only; no MCP tool writes it.
- Every write tool supports `dryRun: true` for preview.
- All-or-nothing atomicity: failed mid-operation tools restore pre-call state.

### Git Commit Risk
- **Medium:** Write tools that commit (`spec_transition`, `spec_handoff`, `spec_task_check`, `spec_task_add`, `spec_index_rebuild`, `spec_init`) emit conventional commits via local `git`.
- Commits inherit `git config user.name` / `user.email` unless profile overrides.
- Push policy is **profile-configurable**; default profile = `never`. The MCP never force-pushes.

### Profile Configuration Risk
- **Low:** `specs/config.yaml` declares profile + overrides. A malicious config could change DTG format, commit style, push policy. Treat `specs/config.yaml` as code: review changes in PRs.

### LLM Prompt Injection
- **Medium:** Spec markdown is read by LLM agents. Malicious content in `spec.md` / `tasks.md` could attempt to influence LLM behavior. The MCP itself does not interpret spec content for execution; it only manipulates structure (status fields, checkboxes, frontmatter tables).

## Security Practices

### Input Validation
- All tool inputs validated via Zod schemas before any FS or git operation.
- Slug names validated against canonical pattern; path traversal rejected.
- Q-table parser strict-mode only; deviations surface as lint findings, not silent acceptance.

### File-System Safety
- Operations confined to `git rev-parse --show-toplevel` + `specs/` subtree.
- No `..` traversal accepted in any input path.
- Symbolic links inside `specs/` not followed for write operations.

### Commit Safety
- Pre-commit verification: refuse when scope paths are not HEAD-clean before mutation (`working_tree_dirty` in `src/tools/_txn.ts`).
- Commits use plain `git commit -m` with no hook or GPG bypass; pre-commit hooks run when configured.

### Dependency Management
- Keep `@modelcontextprotocol/sdk`, `yaml`, `zod` up-to-date.
- Git subprocess calls use `execFileSync("git", …)` in `src/spec/git.ts` and `src/tools/_txn.ts` — no git wrapper library.
- Run `bun audit` regularly; address high/critical vulnerabilities.
- Review major version updates for API contract changes.

## Supported Versions

Latest minor release on the active major.

| Version | Supported |
|---------|-----------|
| 0.7.x   | ✅ Yes |
| 0.0.x – 0.6.x | ⚠️ Unsupported |

## Known Vulnerabilities

None currently known. Reports welcome via security@rethunk.tech.

## Third-Party Security

- **Bun runtime:** keep updated for security patches.
- **`@modelcontextprotocol/sdk`:** monitor for updates.
- **Git CLI:** invoked via `execFileSync` in `src/spec/git.ts`; no network.
- **`yaml`:** parses `specs/config.yaml`; deserializes plain data only (no anchors / `!!js/function` style attacks possible — `yaml` package safe-by-default).

## Testing & Validation

- Test tools against fixture repos before live use.
- Validate `dryRun` parity with live calls.
- Test invariant enforcement with intentionally-corrupt fixtures.

## Incident Response

1. **Report immediately** to security@rethunk.tech (do not disclose publicly).
2. **Include reproduction steps** and affected version(s).
3. **Allow 24-48 hours** for initial response and triage.
4. **Coordinate disclosure** timeline if patch is required.
5. **Credit will be given** to the reporter (if desired).

## Contact

- **Security issues:** security@rethunk.tech
- **General support:** support@rethunk.tech
- **Website:** https://rethunk.tech
