<!--
Thanks for the contribution. Fill the sections below; delete any that genuinely don't apply.
For commit / scope conventions see CONTRIBUTING.md.
-->

## Summary

<!-- 1-3 sentences. WHY this change exists, not WHAT the diff already shows. -->

## Type of change

<!-- Tick one or more. -->

- [ ] `feat` — new capability
- [ ] `fix` — bug corrected
- [ ] `docs` — documentation only
- [ ] `refactor` — no behavior change
- [ ] `test` — test additions or fixes
- [ ] `chore` — maintenance, deps, tooling
- [ ] `ci` — CI/CD config
- [ ] `build` — build system

## Contract impact

<!-- Tick all that apply. -->

- [ ] Public tool surface changed (added/removed/renamed) — PRD § 4 + AGENTS.md tool surface + HUMANS.md table updated
- [ ] Profile config schema changed — CHANGELOG.md migration note added
- [ ] State machine changed — PRD § 5 + transitions tests updated
- [ ] File-system contract changed — PRD § 6 + invariants checker updated
- [ ] None of the above

## Checklist

- [ ] `bun run build` passes
- [ ] `bun run check` passes (no Biome errors)
- [ ] `bun run test` passes
- [ ] New tool / profile / lint rule has a test file
- [ ] Contract changes updated their canon location per [AGENTS.md "Contract-change rules"](../AGENTS.md#contract-change-rules)
- [ ] Commit messages follow `type(scope): subject` convention
- [ ] No secrets or tokens in diff

## Reviewer notes

<!-- Anything reviewers should focus on, edge cases you considered, follow-ups deferred to a separate PR. -->
