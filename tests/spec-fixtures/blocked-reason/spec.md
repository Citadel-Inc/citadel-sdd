# Blocked with reason

| | |
|---|---|
| Status | BLOCKED 011930ZMAY26 — awaiting external dependency |
| Owner | TestAgent |
| Approved | 011910ZMAY26 |

## Blocking

External vendor library `@example/needed-pkg` is not yet published to npm. Cannot proceed with integration tests until upstream releases v1.0.

## Summary

Fixture for a spec that progressed to IN_PROGRESS, then hit a hard external blocker.

## Decisions

| # | Question | Proposed default | NOMAD |
|---|----------|------------------|-------|
| Q1 | Wait for upstream? | Yes | Ratified 011915ZMAY26 |
