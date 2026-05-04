import type { Command } from "commander";
import { migrateModelOperation } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Migrate model to the current schema version.")
    .action(async (_options, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
        writeJson(await migrateModelOperation({ paths, dryRun, reason }), pretty);
      });
    });
}
