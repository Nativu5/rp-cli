import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a state file from module defaults.")
    .option("--force", "overwrite an existing state file");
}
