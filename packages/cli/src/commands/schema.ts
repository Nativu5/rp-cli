import type { Command } from "commander";

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Output state or action JSON Schema.")
    .argument("[target]", "state or action")
    .argument("[name]", "action name");
}
