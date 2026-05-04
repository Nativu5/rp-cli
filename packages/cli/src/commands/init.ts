import type { Command } from "commander";
import {
  createModelEnvelope,
  loadModule,
  pathExists,
  RpError,
  validateAuthorModel,
  withModelLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a model file from module defaults.")
    .option("--force", "overwrite an existing model file")
    .action(async (options: { force?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        await withModelLock(paths, async () => {
          if (!options.force && (await pathExists(paths.modelPath))) {
            throw new RpError("WRITE_FAILED", `model file already exists: ${paths.modelPath}`);
          }

          const module = await loadModule(paths.modulePath);
          const defaults = await module.model.defaults();
          const model = validateAuthorModel(module, defaults);
          const envelope = createModelEnvelope(module, model);

          await writeJsonFileAtomic(paths.modelPath, envelope);
          writeJson(envelope, pretty);
        });
      });
    });
}
