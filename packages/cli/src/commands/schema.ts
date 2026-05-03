import type { Command } from "commander";
import {
  exportActionInputSchema,
  exportStateSchema,
  findAction,
  loadModule,
  RpError
} from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Output state or action JSON Schema.")
    .argument("[target]", "state or action")
    .argument("[name]", "action name")
    .action(
      async (
        target: string | undefined,
        name: string | undefined,
        _options,
        command
      ) => {
        await runCommand(command, async ({ paths, pretty }) => {
          const module = await loadModule(paths.modulePath);

          if (target === undefined || target === "state") {
            writeJson(exportStateSchema(module), pretty);
            return;
          }

          if (target === "action") {
            if (!name) {
              throw new RpError("ACTION_NOT_FOUND", "action name is required");
            }

            writeJson(exportActionInputSchema(findAction(module.actions, name)), pretty);
            return;
          }

          throw new RpError(
            "SCHEMA_EXPORT_FAILED",
            `unsupported schema target: ${target}`
          );
        });
      }
    );
}
