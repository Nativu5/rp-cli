import type { Command } from "commander";
import { validateModelOperation } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate the current model file.")
    .action(async (_options, command) => {
      await runCommand(command, async ({ paths }) => {
        writeJson(await validateModelOperation({ paths }));
      });
    });
}
