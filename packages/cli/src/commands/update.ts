import type { Command } from "commander";
import {
  appendJsonLogEntry,
  applyJsonPatch,
  assertJsonPatch,
  createRuntimeContext,
  hashModel,
  loadModule,
  readModelFile,
  updateModelEnvelope,
  validateAuthorModel,
  validateModelFile,
  withModelLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { readJsonInput } from "../jsonInput.js";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Apply a JSON Patch update to author model.")
    .argument("[patch]", "JSON Patch string")
    .option("--file <path>", "read JSON Patch from a file")
    .action(async (patchArgument: string | undefined, options: { file?: string }, command) => {
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
        const patchInput = await readJsonInput({
          inline: patchArgument,
          filePath: options.file,
          errorCode: "PATCH_INVALID",
          description: "JSON Patch"
        });
        assertJsonPatch(patchInput);
        const patch = patchInput;

        await withModelLock(paths, async () => {
          const module = await loadModule(paths.modulePath);
          const envelope = validateModelFile(module, await readModelFile(paths.modelPath));
          const nextModel = validateAuthorModel(module, applyJsonPatch(envelope.model, patch));
          const ctx = createRuntimeContext();
          const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

          if (!dryRun) {
            await writeJsonFileAtomic(paths.modelPath, nextEnvelope);
            await appendJsonLogEntry(paths.logPath, {
              id: ctx.id("log"),
              time: ctx.now(),
              type: "update",
              ...(reason === undefined ? {} : { reason }),
              patch,
              modelHashBefore: hashModel(envelope.model),
              modelHashAfter: hashModel(nextModel)
            });
          }

          writeJson(
            {
              patch,
              model: nextModel
            },
            pretty
          );
        });
      });
    });
}
