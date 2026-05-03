import type { Command } from "commander";

export function registerPatchCommand(program: Command): void {
  program
    .command("patch")
    .description("Apply a JSON Patch to author state.")
    .argument("[patch]", "JSON Patch string")
    .option("--file <path>", "read JSON Patch from a file");
}
