import type { Command } from "commander";

export function registerActionsCommand(program: Command): void {
  program
    .command("actions")
    .description("List actions or show one action.")
    .argument("[name]", "action name");
}
