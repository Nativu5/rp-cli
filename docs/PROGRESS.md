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

- [ ] Implement full `fast-json-patch` validation and apply flow.
- [ ] Implement `rp patch`.
- [ ] Implement action input validation.
- [ ] Implement action return validation.
- [ ] Implement `rp action`.
- [ ] Implement generated action CLI output.

## Phase 5: Migration

- [ ] Implement schema version comparison.
- [ ] Implement `rp migrate`.
- [ ] Return `MIGRATION_REQUIRED` for old state versions outside migrate.
- [ ] Return `MIGRATION_FAILED` for newer state files.
- [ ] Log successful migrations.

## Phase 6: Discovery And Read APIs

- [ ] Implement summary selection.
- [ ] Implement `rp summary`.
- [ ] Implement `rp action --list`.
- [ ] Implement `rp summary --list`.
- [ ] Implement JSON Schema export.
- [ ] Implement `rp schema`.

## Phase 7: Logging

- [ ] Implement JSONL log append.
- [ ] Implement `rp log`.
- [ ] Include CLI reason, action reason, action message, patch, and state hashes.
- [ ] Return `LOG_WRITE_FAILED` without rolling back state writes.

## Phase 8: Examples And Tests

- [ ] Complete `examples/life-sim/rp.module.ts`.
- [ ] Add `examples/life-sim/README.md`.
- [ ] Add unit tests for core runtime behavior.
- [ ] Add CLI integration tests.
- [ ] Cover invalid input, invalid patch, schema violation, migration, and log cases.

## Current Next Step

Start Phase 4 by implementing full JSON Patch validation/apply flow, `rp patch`, action input validation, action return validation, `rp action`, and generated action CLI output.

## Architecture Notes

- `@rp-cli/core` is the public creator API. It should expose `defineModule` and creator-facing types only.
- `@rp-cli/core/internal` is the CLI/runtime API. It exposes module loading, module parsing, state file helpers, validation, logging, schema, action, summary, patch, and migration helpers.
- Unknown module exports must be parsed with `parseModule(value: unknown)` instead of casting at the call site.
