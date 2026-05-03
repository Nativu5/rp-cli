import type { Command } from "commander";

export function registerStateCommand(program: Command): void {
  program
    .command("state")
    .description("Output the author state.")
    .option("--raw", "output the full state envelope");
}
