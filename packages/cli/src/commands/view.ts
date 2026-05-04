import type { Command } from "commander";
import {
  findView,
  listViews,
  loadModule,
  readModelFile,
  runView,
  validateModelFile
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerViewCommand(program: Command): void {
  program
    .command("view")
    .description("Run or list module views.")
    .argument("[name]", "view name")
    .option("--list", "list available views")
    .action(async (name: string | undefined, options: { list?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        const module = await loadModule(paths.modulePath);

        if (options.list) {
          writeJson(listViews(module.views), pretty);
          return;
        }

        const view = findView(module.views, name);
        const envelope = validateModelFile(module, await readModelFile(paths.modelPath));

        writeJson(
          await runView({
            view: view.run,
            model: envelope.model,
            meta: envelope.rp
          }),
          pretty
        );
      });
    });
}
