import type { Command } from "commander";
import {
  exportActionInputSchemaOperation,
  listActionSummariesOperation,
  RpError,
  runActionOperation
} from "@rp-cli/core/internal";
import { readJsonInput } from "../jsonInput.js";
import { runCommand } from "../commandRunner.js";
import { writeJson, writeResult } from "../output.js";

export function registerActionCommand(program: Command): void {
  program
    .command("action")
    .description("Run an action (named update) or list all actions.")
    .argument("[name]", "action name")
    .argument("[input]", "action input JSON")
    .option("--list", "list available actions")
    .option("--schema", "output the action input JSON Schema")
    .option("--file <path>", "read action input from a file")
    .action(
      async (
        name: string | undefined,
        inputArgument: string | undefined,
        options: { list?: boolean; schema?: boolean; file?: string },
        command
      ) => {
        await runCommand(command, async ({ paths, output, dryRun, reason }) => {
          if (options.list) {
            writeJson(await listActionSummariesOperation({ paths }));
            return;
          }

          if (!name) {
            throw new RpError("ACTION_NOT_FOUND", "action name is required");
          }

          if (options.schema) {
            writeJson(await exportActionInputSchemaOperation({ paths, name }));
            return;
          }

          const actionInput = await readJsonInput({
            inline: inputArgument,
            filePath: options.file,
            errorCode: "ACTION_INPUT_INVALID",
            description: "action input"
          });
          writeResult(
            await runActionOperation({
              paths,
              name,
              actionInput,
              dryRun,
              reason
            }),
            output
          );
        });
      }
    );
}
