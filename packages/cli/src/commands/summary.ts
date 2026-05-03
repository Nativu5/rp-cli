import type { Command } from "commander";
import {
  findSummary,
  listSummaries,
  loadModule,
  readStateFile,
  runSummary,
  validateStateFile
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerSummaryCommand(program: Command): void {
  program
    .command("summary")
    .description("Run or list module summaries.")
    .argument("[name]", "summary name")
    .option("--list", "list available summaries")
    .action(
      async (
        name: string | undefined,
        options: { list?: boolean },
        command
      ) => {
        await runCommand(command, async ({ paths, pretty }) => {
          const module = await loadModule(paths.modulePath);

          if (options.list) {
            writeJson(listSummaries(module.summaries), pretty);
            return;
          }

          const summary = findSummary(module.summaries, name);
          const envelope = validateStateFile(
            module,
            await readStateFile(paths.statePath)
          );

          writeJson(
            await runSummary({
              summary: summary.run,
              state: envelope.state,
              meta: envelope.rp
            }),
            pretty
          );
        });
      }
    );
}
