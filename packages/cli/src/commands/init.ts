import type { Command } from "commander";
import {
  createStateEnvelope,
  loadModule,
  pathExists,
  RpError,
  validateAuthorState,
  withFileLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a state file from module defaults.")
    .option("--force", "overwrite an existing state file")
    .action(async (options: { force?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        await withFileLock(paths.lockPath, async () => {
          if (!options.force && (await pathExists(paths.statePath))) {
            throw new RpError(
              "WRITE_FAILED",
              `state file already exists: ${paths.statePath}`
            );
          }

          const module = await loadModule(paths.modulePath);
          const defaults = await module.state.defaults();
          const state = validateAuthorState(module, defaults);
          const envelope = createStateEnvelope(module, state);

          await writeJsonFileAtomic(paths.statePath, envelope);
          writeJson(envelope, pretty);
        });
      });
    });
}
