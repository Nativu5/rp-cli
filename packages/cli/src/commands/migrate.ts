import type { Command } from "commander";
import {
  appendJsonLogEntry,
  assertModuleCompatibility,
  compareSchemaVersions,
  createRuntimeContext,
  hashState,
  loadModule,
  readStateFile,
  RpError,
  runMigration,
  updateStateEnvelope,
  validateAuthorState,
  withStateLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate state to the current schema version.")
    .action(async (_options, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
        await withStateLock(paths, async () => {
          const module = await loadModule(paths.modulePath);
          const envelope = await readStateFile(paths.statePath);
          assertModuleCompatibility(envelope.rp, module);
          const fromVersion = envelope.rp.schemaVersion;
          const toVersion = module.state.version;
          const comparison = compareSchemaVersions(fromVersion, toVersion);

          if (comparison === "current") {
            const state = validateAuthorState(module, envelope.state);
            writeJson({ fromVersion, toVersion, state }, pretty);
            return;
          }

          if (comparison === "newer") {
            throw new RpError(
              "MIGRATION_FAILED",
              "state schemaVersion is newer than module state.version",
              { fromVersion, toVersion }
            );
          }

          const ctx = createRuntimeContext();
          const nextState = validateAuthorState(
            module,
            await runMigration({
              migrate: module.state.migrate,
              state: envelope.state,
              fromVersion,
              toVersion,
              meta: envelope.rp,
              ctx
            })
          );
          const nextEnvelope = updateStateEnvelope(envelope, module, nextState, ctx.now());

          if (!dryRun) {
            await writeJsonFileAtomic(paths.statePath, nextEnvelope);
            await appendJsonLogEntry(paths.logPath, {
              id: ctx.id("log"),
              time: ctx.now(),
              type: "migrate",
              fromVersion,
              toVersion,
              ...(reason === undefined ? {} : { reason }),
              stateHashBefore: hashState(envelope.state),
              stateHashAfter: hashState(nextState)
            });
          }

          writeJson({ fromVersion, toVersion, state: nextState }, pretty);
        });
      });
    });
}
