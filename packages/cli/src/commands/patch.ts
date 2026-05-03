import type { Command } from "commander";
import {
  applyJsonPatch,
  assertJsonPatch,
  loadModule,
  readStateFile,
  updateStateEnvelope,
  validateAuthorState,
  validateStateFile,
  withFileLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { readJsonInput } from "../jsonInput.js";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerPatchCommand(program: Command): void {
  program
    .command("patch")
    .description("Apply a JSON Patch to author state.")
    .argument("[patch]", "JSON Patch string")
    .option("--file <path>", "read JSON Patch from a file")
    .action(async (patchArgument: string | undefined, options: { file?: string }, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun }) => {
        const patchInput = await readJsonInput({
          inline: patchArgument,
          filePath: options.file,
          errorCode: "PATCH_INVALID",
          description: "JSON Patch"
        });
        assertJsonPatch(patchInput);
        const patch = patchInput;

        await withFileLock(paths.lockPath, async () => {
          const module = await loadModule(paths.modulePath);
          const envelope = validateStateFile(module, await readStateFile(paths.statePath));
          const nextState = validateAuthorState(module, applyJsonPatch(envelope.state, patch));
          const nextEnvelope = updateStateEnvelope(envelope, module, nextState);

          if (!dryRun) {
            await writeJsonFileAtomic(paths.statePath, nextEnvelope);
          }

          writeJson(
            {
              patch,
              state: nextState
            },
            pretty
          );
        });
      });
    });
}
