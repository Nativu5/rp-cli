import type { Command } from "commander";
import { initModelOperation } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a model file from module defaults.")
    .option("--force", "overwrite an existing model file")
    .action(async (options: { force?: boolean }, command) => {
      await runCommand(command, async ({ paths }) => {
        writeJson(await initModelOperation({ paths, force: options.force }));
      });
    });
}
