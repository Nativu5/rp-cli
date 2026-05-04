import type { Command } from "commander";
import {
  appendJsonLogEntry,
  applyJsonPatch,
  createRuntimeContext,
  exportActionInputSchema,
  findAction,
  hashModel,
  loadModule,
  readModelFile,
  RpError,
  runAction,
  updateModelEnvelope,
  validateActionInput,
  validateAuthorModel,
  validateModelFile,
  withModelLock,
  writeJsonFileAtomic
} from "@rp-cli/core/internal";
import { readJsonInput } from "../jsonInput.js";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerActionCommand(program: Command): void {
  program
    .command("action")
    .description("Run or list module actions.")
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
        await runCommand(command, async ({ paths, pretty, dryRun, reason }) => {
          const module = await loadModule(paths.modulePath);

          if (options.list) {
            writeJson(listActions(module.actions), pretty);
            return;
          }

          if (!name) {
            throw new RpError("ACTION_NOT_FOUND", "action name is required");
          }

          const action = findAction(module.actions, name);

          if (options.schema) {
            writeJson(exportActionInputSchema(action), pretty);
            return;
          }

          const inputJson = await readJsonInput({
            inline: inputArgument,
            filePath: options.file,
            errorCode: "ACTION_INPUT_INVALID",
            description: "action input"
          });
          const input = validateActionInput(action, inputJson);

          await withModelLock(paths, async () => {
            const envelope = validateModelFile(module, await readModelFile(paths.modelPath));
            const ctx = createRuntimeContext();
            const result = await runAction({
              action,
              model: envelope.model,
              input,
              meta: envelope.rp,
              ctx
            });

            if (result.patch.length === 0) {
              writeJson(
                {
                  result: null,
                  ...(result.message === undefined ? {} : { message: result.message })
                },
                pretty
              );
              return;
            }

            const nextModel = validateAuthorModel(
              module,
              applyJsonPatch(envelope.model, result.patch)
            );
            const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

            if (!dryRun) {
              await writeJsonFileAtomic(paths.modelPath, nextEnvelope);
              await appendJsonLogEntry(paths.logPath, {
                id: ctx.id("log"),
                time: ctx.now(),
                type: "action",
                name,
                ...(reason === undefined ? {} : { reason }),
                ...(result.reason === undefined ? {} : { actionReason: result.reason }),
                ...(result.message === undefined ? {} : { message: result.message }),
                input,
                patch: result.patch,
                modelHashBefore: hashModel(envelope.model),
                modelHashAfter: hashModel(nextModel)
              });
            }

            writeJson(
              {
                result: {
                  patch: result.patch,
                  model: nextModel
                },
                ...(result.message === undefined ? {} : { message: result.message })
              },
              pretty
            );
          });
        });
      }
    );
}

function listActions(
  actions: Parameters<typeof findAction>[0]
): { name: string; description: string }[] {
  return Object.entries(actions ?? {}).map(([name, action]) => ({
    name,
    description: action.description
  }));
}
