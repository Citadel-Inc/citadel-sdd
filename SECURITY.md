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
- **Medium:** Tools edit `specs/active/*`, `specs/done/*`, `specs/README.md`, `HUMAN_BLOCKERS.md`.
- All writes are scoped to the repo's `specs/` tree (and optionally `HUMAN_BLOCKERS.md` at repo root). The server refuses operations on paths outside `git rev-parse --show-toplevel`.
- Every write tool supports `dryRun: true` for preview.
- All-or-nothing atomicity: failed mid-operation tools restore pre-call state.

### Git Commit Risk
- **Medium:** Composite write tools (`spec_claim`, `spec_close`, `spec_reopen`, `spec_block`, `spec_unblock`, `spec_index_rebuild`) emit conventional commits via local `git`.
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
- Pre-commit verification: working tree dirty-check (per memory `batch_commit may pick up extra dirty files`); refuse to commit unless `--allow-dirty` set.
- No `--no-verify` / `--no-gpg-sign` from the MCP. Hooks run if configured.

### Dependency Management
- Keep `@modelcontextprotocol/sdk`, `yaml`, `zod`, `simple-git` up-to-date.
- Run `bun audit` regularly; address high/critical vulnerabilities.
- Review major version updates for API contract changes.

## Supported Versions

Latest minor release on the active major.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes (post-v0.1.0) |
| 0.0.x   | ⚠️ Pre-release; best-effort |

## Known Vulnerabilities

None currently known. Reports welcome via security@rethunk.tech.

## Third-Party Security

- **Bun runtime:** keep updated for security patches.
- **`@modelcontextprotocol/sdk`:** monitor for updates.
- **`simple-git`:** wraps local `git`; no network.
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

---

**Last updated:** 2026-05-01
