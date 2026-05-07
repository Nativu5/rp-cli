import type { Command } from "commander";
import { applyUpdateOperation } from "@rp-cli/core/internal";
import { readJsonInput } from "../jsonInput.js";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Apply a JSON Patch (RFC 6902) to role model.")
    .argument("[patch]", "JSON Patch string (RFC 6902)")
    .option("--file <path>", "read JSON Patch from a file")
    .action(async (patchArgument: string | undefined, options: { file?: string }, command) => {
      await runCommand(command, async ({ paths, dryRun, reason }) => {
        const patchInput = await readJsonInput({
          inline: patchArgument,
          filePath: options.file,
          errorCode: "PATCH_INVALID",
          description: "JSON Patch"
        });

        writeJson(
          await applyUpdateOperation({
            paths,
            patch: patchInput,
            dryRun,
            reason
          })
        );
      });
    });
}
