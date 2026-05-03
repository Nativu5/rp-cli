import type { Command } from "commander";
import {
  appendJsonLogEntry,
  applyJsonPatch,
  assertJsonPatch,
  createRuntimeContext,
  hashState,
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
      await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
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
          const ctx = createRuntimeContext();
          const nextEnvelope = updateStateEnvelope(envelope, module, nextState, ctx.now());

          if (!dryRun) {
            await writeJsonFileAtomic(paths.statePath, nextEnvelope);
            await appendJsonLogEntry(paths.logPath, {
              id: ctx.id("log"),
              time: ctx.now(),
              type: "patch",
              ...(reason === undefined ? {} : { reason }),
              patch,
              stateHashBefore: hashState(envelope.state),
              stateHashAfter: hashState(nextState)
            });
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
