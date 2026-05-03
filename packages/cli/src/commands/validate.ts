import type { Command } from "commander";

export function registerValidateCommand(program: Command): void {
  program.command("validate").description("Validate the current state file.");
}
