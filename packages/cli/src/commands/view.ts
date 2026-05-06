import type { Command } from "commander";
import { listViewsOperation, runViewOperation } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerViewCommand(program: Command): void {
  program
    .command("view")
    .description("Run or list model views.")
    .argument("[name]", "view name")
    .option("--list", "list available views")
    .action(async (name: string | undefined, options: { list?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
        if (options.list) {
          writeJson(await listViewsOperation({ paths }), pretty);
          return;
        }

        writeJson(await runViewOperation({ paths, name, dryRun, reason }), pretty);
      });
    });
}
