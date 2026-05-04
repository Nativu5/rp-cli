import type { Command } from "commander";
import {
  appendJsonLogEntry,
  assertModuleCompatibility,
  compareSchemaVersions,
  createRuntimeContext,
  hashModel,
  loadModule,
  readModelFile,
  RpError,
  runMigration,
  updateModelEnvelope,
  validateAuthorModel,
  withModelLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate model to the current schema version.")
    .action(async (_options, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
        await withModelLock(paths, async () => {
          const module = await loadModule(paths.modulePath);
          const envelope = await readModelFile(paths.modelPath);
          assertModuleCompatibility(envelope.rp, module);
          const fromVersion = envelope.rp.schemaVersion;
          const toVersion = module.model.version;
          const comparison = compareSchemaVersions(fromVersion, toVersion);

          if (comparison === "current") {
            const model = validateAuthorModel(module, envelope.model);
            writeJson({ fromVersion, toVersion, model }, pretty);
            return;
          }

          if (comparison === "newer") {
            throw new RpError(
              "MIGRATION_FAILED",
              "model schemaVersion is newer than module model.version",
              { fromVersion, toVersion }
            );
          }

          const ctx = createRuntimeContext();
          const nextModel = validateAuthorModel(
            module,
            await runMigration({
              migrate: module.model.migrate,
              model: envelope.model,
              fromVersion,
              toVersion,
              meta: envelope.rp,
              ctx
            })
          );
          const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

          if (!dryRun) {
            await writeJsonFileAtomic(paths.modelPath, nextEnvelope);
            await appendJsonLogEntry(paths.logPath, {
              id: ctx.id("log"),
              time: ctx.now(),
              type: "migrate",
              fromVersion,
              toVersion,
              ...(reason === undefined ? {} : { reason }),
              modelHashBefore: hashModel(envelope.model),
              modelHashAfter: hashModel(nextModel)
            });
          }

          writeJson({ fromVersion, toVersion, model: nextModel }, pretty);
        });
      });
    });
}
