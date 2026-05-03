import type { Command } from "commander";
import { loadModule, readStateFile, validateStateFile } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerStateCommand(program: Command): void {
  program
    .command("state")
    .description("Output the author state.")
    .option("--raw", "output the full state envelope")
    .action(async (options: { raw?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        const module = await loadModule(paths.modulePath);
        const envelope = validateStateFile(module, await readStateFile(paths.statePath));

        writeJson(options.raw ? envelope : envelope.state, pretty);
      });
    });
}
