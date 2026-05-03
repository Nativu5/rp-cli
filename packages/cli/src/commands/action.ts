import type { Command } from "commander";

export function registerActionCommand(program: Command): void {
  program
    .command("action")
    .description("Run or list module actions.")
    .argument("[name]", "action name")
    .argument("[input]", "action input JSON")
    .option("--list", "list available actions")
    .option("--file <path>", "read action input from a file");
}
