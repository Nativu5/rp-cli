import type { Command } from "commander";
import {
  exportModelSchema,
  loadModule,
  readModelFile,
  validateModelFile
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerModelCommand(program: Command): void {
  program
    .command("model")
    .description("Output the author model.")
    .option("--raw", "output the full model envelope")
    .option("--schema", "output the model JSON Schema")
    .action(async (options: { raw?: boolean; schema?: boolean }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        const module = await loadModule(paths.modulePath);

        if (options.schema) {
          writeJson(exportModelSchema(module), pretty);
          return;
        }

        const envelope = validateModelFile(module, await readModelFile(paths.modelPath));

        writeJson(options.raw ? envelope : envelope.model, pretty);
      });
    });
}
