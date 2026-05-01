# Profile system

Permanent canon for: profile config schema, inheritance, slug uniqueness, shipped profiles.

## Config location

`specs/config.yaml` rooted in the consuming repo. Single canonical path — no `.sdd/` directory, no home-directory config, no environment-variable override.

## Inheritance

```
default (vanilla SDD baseline)
  └── bastion (DTG injection, IRONLAW callouts, conventional commit + Bastion voice)
        └── citadel (bastion + citadel paths/conventions + push: on_close)
```

`extends:` key declares the parent. Resolver walks the chain bottom-up, deep-merges parent → child, child overrides parent at leaf level.

Cycle detection is mandatory: a profile that (transitively) extends itself is rejected at load with `profile_chain_broken`.

## Config schema

```yaml
extends: bastion           # default | bastion | citadel | (none, for fully-explicit configs)
spec_dir: specs            # canonical; rarely overridden
states:
  - DRAFT
  - APPROVED
  - IN_PROGRESS
  - BLOCKED
  - DONE
priorities: [P0, P1, P2]
dtg_format: DDHHMMZMONYY    # ISO-8601 for default profile; bastion+citadel use DDHHMMZMONYY
commit_style: conventional   # conventional | freeform
push_policy: never           # never | on_close | always
```

### Validation

Loaded via Zod schema in `src/config/load.ts`. Failures surface as `config_invalid` with the offending key path.

## Shipped profile defaults

### `default` (neutral SDD baseline)

```yaml
spec_dir: specs
states: [DRAFT, APPROVED, IN_PROGRESS, BLOCKED, DONE]
priorities: [P0, P1, P2]
dtg_format: ISO-8601
commit_style: freeform
push_policy: never
```

### `bastion` (extends `default`)

```yaml
extends: default
dtg_format: DDHHMMZMONYY
commit_style: conventional
# (DTG injection + IRONLAW callouts hooked in tool implementations,
# not exposed as config keys — they activate when extends-chain
# resolves to bastion or its descendants)
```

### `citadel` (extends `bastion`)

```yaml
extends: bastion
push_policy: on_close
# (citadel paths inherited from spec_dir: specs; no override needed)
```

## Slug uniqueness

**Enforced forever, not configurable.** A slug used in `specs/active/` or `specs/done/` is held permanently; reuse rejected even after `spec_close`.

This rule is hard-coded in `src/spec/invariants.ts`. No profile can override. Rationale: prevents accidental history overwrite when a closed spec's slug gets reused for unrelated future work.

## Bastion-specific features

When the resolved profile chain includes `bastion` (i.e., effective profile is `bastion` or `citadel`):

- **DTG format** = `DDHHMMZMONYY` (e.g. `011945ZMAY26`).
- **Commit style** = conventional.
- **Status-line voice** = militant (e.g. `IN_PROGRESS 011945ZMAY26 — Bastion claims execution`).
- **IRONLAW callouts** = lint warnings for status fields that drift from canonical Bastion shape.

Non-bastion chains (`default` only) get neutral ISO-8601 DTG, freeform commits, generic status-line voice, no IRONLAW lint.
