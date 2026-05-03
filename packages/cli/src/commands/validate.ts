import type { Command } from "commander";
import {
  loadModule,
  readStateFile,
  validateStateFile
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate the current state file.")
    .action(async (_options, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        const module = await loadModule(paths.modulePath);
        const envelope = validateStateFile(module, await readStateFile(paths.statePath));

        writeJson(
          {
            valid: true,
            module: envelope.rp.module,
            moduleVersion: envelope.rp.moduleVersion,
            schemaVersion: envelope.rp.schemaVersion
          },
          pretty
        );
      });
    });
}
