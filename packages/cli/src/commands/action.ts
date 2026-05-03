import type { Command } from "commander";
import {
  applyJsonPatch,
  createRuntimeContext,
  findAction,
  loadModule,
  readStateFile,
  RpError,
  runAction,
  updateStateEnvelope,
  validateActionInput,
  validateAuthorState,
  validateStateFile,
  withFileLock,
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
    .option("--file <path>", "read action input from a file")
    .action(
      async (
        name: string | undefined,
        inputArgument: string | undefined,
        options: { list?: boolean; file?: string },
        command
      ) => {
        await runCommand(command, async ({ paths, pretty, dryRun }) => {
          const module = await loadModule(paths.modulePath);

          if (options.list) {
            writeJson(listActions(module.actions), pretty);
            return;
          }

          if (!name) {
            throw new RpError("ACTION_NOT_FOUND", "action name is required");
          }

          const action = findAction(module.actions, name);
          const inputJson = await readJsonInput({
            inline: inputArgument,
            filePath: options.file,
            errorCode: "ACTION_INPUT_INVALID",
            description: "action input"
          });
          const input = validateActionInput(action, inputJson);

          await withFileLock(paths.lockPath, async () => {
            const envelope = validateStateFile(module, await readStateFile(paths.statePath));
            const result = await runAction({
              action,
              state: envelope.state,
              input,
              meta: envelope.rp,
              ctx: createRuntimeContext()
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

            const nextState = validateAuthorState(
              module,
              applyJsonPatch(envelope.state, result.patch)
            );
            const nextEnvelope = updateStateEnvelope(envelope, module, nextState);

            if (!dryRun) {
              await writeJsonFileAtomic(paths.statePath, nextEnvelope);
            }

            writeJson(
              {
                result: {
                  patch: result.patch,
                  state: nextState
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
