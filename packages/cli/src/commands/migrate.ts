import type { Command } from "commander";

export function registerMigrateCommand(program: Command): void {
  program.command("migrate").description("Migrate state to the current schema version.");
}
