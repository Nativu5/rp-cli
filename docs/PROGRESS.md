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
- [x] Implement model file path, log path, and lock path helpers.

## Phase 3: Model Lifecycle Commands

- [x] Implement `rp init`.
- [x] Implement `rp validate`.
- [x] Implement `rp model`.
- [x] Implement atomic model file writes.
- [x] Implement basic write locking.

## Phase 4: Update And Action Writes

- [x] Implement full `fast-json-patch` validation and apply flow.
- [x] Implement `rp update`.
- [x] Implement action input validation.
- [x] Implement action return validation.
- [x] Implement `rp action`.
- [x] Implement generated action CLI output.

## Phase 5: Migration

- [x] Implement schema version comparison.
- [x] Implement `rp migrate`.
- [x] Return `MIGRATION_REQUIRED` for old model versions outside migrate.
- [x] Return `MIGRATION_FAILED` for newer model files.
- [x] Log successful migrations.

## Phase 6: Discovery And Read APIs

- [x] Implement view selection.
- [x] Implement `rp view`.
- [x] Implement `rp action --list`.
- [x] Implement `rp view --list`.
- [x] Implement JSON Schema export.
- [x] Implement object-local JSON Schema export through `rp model --schema` and `rp action <name> --schema`.

## Phase 7: Logging

- [x] Implement JSONL log append.
- [x] Implement `rp log`.
- [x] Include CLI reason, action reason, action message, patch, and model hashes.
- [x] Return `LOG_WRITE_FAILED` without rolling back model writes.

## Phase 8: Examples And Tests

- [x] Complete `examples/life-sim/rp.module.ts`.
- [x] Add `examples/life-sim/README.md`.
- [x] Add unit tests for core runtime behavior.
- [x] Add CLI integration tests.
- [x] Cover invalid input, invalid patch, schema violation, migration, and log cases.

## Current Next Step

All planned MVP phases are complete; current next step is remaining P1 release-readiness hardening.

## Release-Readiness Hardening

- [x] P0: Declare the Node runtime contract for local TypeScript module loading.
- [x] P0: Reject unsupported module file extensions before import.
- [x] P0: Reject model files owned by a different module with `MODULE_MODEL_MISMATCH`.
- [x] P0: Reject cross-module migrations.
- [x] P0: Pass action and view handlers a deep-frozen clone of model data so direct mutation cannot bypass JSON Patch.
- [x] P1: Replace the hand-written lockfile implementation with `proper-lockfile`.
- [x] P1: Recover stale model locks and briefly wait for active locks to release.
- [ ] P1: Add dist/bin package smoke tests and CI.
- [ ] P1: Add project config / upward discovery.
- [ ] P1: Add user-facing lock diagnostics and configurable lock timing.

## Model/View/Action/Update Refactor

Decision: because RP CLI has not been released, the architecture has been normalized around Model/View/Action/Update without preserving legacy aliases. `action` remains as a first-class creator concept because it describes a creator-defined named operation that may have imperative behavior; raw JSON Patch writes now live under `update`.

Vocabulary:

```text
Model  = creator-defined persistent data model
View   = read-only projection over Model
Action = creator-defined named operation
Update = low-level JSON Patch update over Model
```

Result:

- [x] Renamed creator module field `state` to `model`.
- [x] Renamed creator module field `summaries` to `views`.
- [x] Renamed public view types to `RpView`, `RpViewFunction`, and `RpViewObject`.
- [x] Kept `actions` and `RpAction` as first-class creator concepts.
- [x] Renamed persisted envelope payload key from `state` to `model`.
- [x] Renamed model-related runtime helpers, files, and imports: `modelFile.ts`, `modelLock.ts`, `modelAccess.ts`, `readModelFile`, `validateModelFile`, `validateAuthorModel`, and `withModelLock`.
- [x] Renamed `rp state` to `rp model` and removed the old command alias.
- [x] Renamed `rp summary` to `rp view` and removed the old command alias.
- [x] Renamed raw write command `rp patch` to `rp update` and removed the old command alias.
- [x] Removed standalone `rp schema`.
- [x] Added object-local schema discovery through `rp model --schema` and `rp action <name> --schema`.
- [x] Renamed user-visible model/view error codes: `MODULE_MODEL_MISMATCH`, `MODEL_NOT_FOUND`, `MODEL_INVALID_JSON`, `MODEL_ENVELOPE_INVALID`, `MODEL_LOCKED`, `VIEW_NOT_FOUND`, and `VIEW_RUNTIME_ERROR`.
- [x] Kept raw JSON Patch errors patch-specific when they describe invalid JSON Patch data.
- [x] Updated tests, README, AGENTS, examples, and planning documents to the new command/API surface.

Not changed:

- `rp.schemaVersion` remains the persisted model schema version field.
- Core `patch.ts` remains the low-level JSON Patch validator/applicator because JSON Patch is still the data format used by `rp update` and action return values.

## Architecture Notes

- `@rp-cli/core` is the public creator API. It should expose `defineModule` and creator-facing types only.
- `@rp-cli/core/internal` is the CLI/runtime API. It exposes module loading, module parsing, model file helpers, validation, logging, schema export, action, view, patch, and migration helpers.
- Unknown module exports must be parsed with `parseModule(value: unknown)` instead of casting at the call site.
- Runtime module loading currently supports `.ts`, `.mts`, `.js`, `.mjs`, and `.cjs` module files on Node `>=24.0.0`.
- Model files are bound to module identity via `rp.module`; schema evolution remains driven by `rp.schemaVersion`.
- Model write locking uses `proper-lockfile` with an atomic `mkdir` lock directory at `<model>.lock`, stale lock recovery, and bounded retries.
