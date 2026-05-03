import type { Command } from "commander";

export function registerSummaryCommand(program: Command): void {
  program
    .command("summary")
    .description("Run or list module summaries.")
    .argument("[name]", "summary name")
    .option("--list", "list available summaries");
}
