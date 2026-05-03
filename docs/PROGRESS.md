# RP CLI Implementation Progress

This file tracks implementation progress against [PLAN.md](./PLAN.md).

## Status Legend

```text
[ ] Not started
[~] In progress
[x] Done
[!] Needs decision
```

## Phase 1: Basic Scaffolding

- [x] Create root Node.js + TypeScript project configuration.
- [x] Create workspace package layout for `@rp-cli/core` and `@rp-cli/cli`.
- [x] Add shared TypeScript configuration.
- [x] Add core source files matching the planned runtime boundaries.
- [x] Add CLI command files matching the planned command set.
- [x] Add initial example module directory.
- [x] Add test runner entry and a smoke test.

Acceptance:

```text
npm install succeeds
npm run typecheck succeeds
npm test succeeds
The repository has clear file targets for the next implementation phase
```

## Phase 2: Core Runtime Foundations

- [x] Implement `defineModule` validation.
- [x] Implement module loading for local TypeScript modules.
- [x] Implement envelope validation.
- [x] Implement JSON output and unified error formatting.
- [x] Implement state file path, log path, and lock path helpers.

## Phase 3: State Lifecycle Commands

- [x] Implement `rp init`.
- [x] Implement `rp validate`.
- [x] Implement `rp state`.
- [x] Implement atomic state file writes.
- [x] Implement basic write locking.

## Phase 4: Patch And Action Writes

- [x] Implement full `fast-json-patch` validation and apply flow.
- [x] Implement `rp patch`.
- [x] Implement action input validation.
- [x] Implement action return validation.
- [x] Implement `rp action`.
- [x] Implement generated action CLI output.

## Phase 5: Migration

- [x] Implement schema version comparison.
- [x] Implement `rp migrate`.
- [x] Return `MIGRATION_REQUIRED` for old state versions outside migrate.
- [x] Return `MIGRATION_FAILED` for newer state files.
- [x] Log successful migrations.

## Phase 6: Discovery And Read APIs

- [x] Implement summary selection.
- [x] Implement `rp summary`.
- [x] Implement `rp action --list`.
- [x] Implement `rp summary --list`.
- [x] Implement JSON Schema export.
- [x] Implement `rp schema`.

## Phase 7: Logging

- [x] Implement JSONL log append.
- [x] Implement `rp log`.
- [x] Include CLI reason, action reason, action message, patch, and state hashes.
- [x] Return `LOG_WRITE_FAILED` without rolling back state writes.

## Phase 8: Examples And Tests

- [x] Complete `examples/life-sim/rp.module.ts`.
- [x] Add `examples/life-sim/README.md`.
- [x] Add unit tests for core runtime behavior.
- [x] Add CLI integration tests.
- [x] Cover invalid input, invalid patch, schema violation, migration, and log cases.

## Current Next Step

All planned MVP phases are complete; next step is P1 release-readiness hardening.

## Release-Readiness Hardening

- [x] P0: Declare the Node runtime contract for local TypeScript module loading.
- [x] P0: Reject unsupported module file extensions before import.
- [x] P0: Reject state files owned by a different module with `MODULE_STATE_MISMATCH`.
- [x] P0: Reject cross-module migrations.
- [x] P0: Pass action and summary handlers a deep-frozen clone of state so direct mutation cannot bypass JSON Patch.
- [x] P1: Replace the hand-written lockfile implementation with `proper-lockfile`.
- [x] P1: Recover stale state locks and briefly wait for active locks to release.
- [ ] P1: Add dist/bin package smoke tests and CI.
- [ ] P1: Add project config / upward discovery.
- [ ] P1: Add user-facing lock diagnostics and configurable lock timing.

## Architecture Notes

- `@rp-cli/core` is the public creator API. It should expose `defineModule` and creator-facing types only.
- `@rp-cli/core/internal` is the CLI/runtime API. It exposes module loading, module parsing, state file helpers, validation, logging, schema, action, summary, patch, and migration helpers.
- Unknown module exports must be parsed with `parseModule(value: unknown)` instead of casting at the call site.
- Runtime module loading currently supports `.ts`, `.mts`, `.js`, `.mjs`, and `.cjs` module files on Node `>=24.0.0`.
- State files are bound to module identity via `rp.module`; schema evolution remains driven by `rp.schemaVersion`.
- State write locking uses `proper-lockfile` with an atomic `mkdir` lock directory at `<state>.lock`, stale lock recovery, and bounded retries.
