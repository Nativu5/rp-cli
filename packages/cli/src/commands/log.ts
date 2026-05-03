import type { Command } from "commander";

export function registerLogCommand(program: Command): void {
  program
    .command("log")
    .description("Read operation logs.")
    .option("--limit <count>", "number of log entries to output");
}
