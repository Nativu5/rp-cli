import type { Command } from "commander";

export function registerSummaryCommand(program: Command): void {
  program
    .command("summary")
    .description("Run a module summary.")
    .argument("[name]", "summary name");
}
