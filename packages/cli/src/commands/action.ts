import type { Command } from "commander";

export function registerActionCommand(program: Command): void {
  program
    .command("action")
    .description("Run a module action.")
    .argument("<name>", "action name")
    .argument("[input]", "action input JSON")
    .option("--file <path>", "read action input from a file");
}
