import type { Command } from "commander";
import { RpError, resolveRpPaths, type RpErrorCode, type RpPaths } from "@rp-cli/core/internal";
import { toErrorShape, writeJson, type OutputMode } from "./output.js";

export interface GlobalCliOptions {
  module?: string;
  model?: string;
  output?: OutputMode;
  dryRun?: boolean;
  reason?: string;
}

export interface CommandContext {
  paths: RpPaths;
  output: OutputMode;
  dryRun: boolean;
  reason?: string;
}

export async function runCommand(command: Command, run: (ctx: CommandContext) => Promise<void>): Promise<void> {
  const options = command.optsWithGlobals<GlobalCliOptions>();
  const context: CommandContext = {
    paths: resolveRpPaths({
      modulePath: options.module,
      modelPath: options.model
    }),
    output: options.output ?? "default",
    dryRun: Boolean(options.dryRun),
    reason: options.reason
  };

  try {
    await run(context);
  } catch (error) {
    writeJson(toErrorShape(error));
    process.exitCode = exitCodeForError(error);
  }
}

function exitCodeForError(error: unknown): number {
  if (!(error instanceof RpError)) {
    return 1;
  }

  const code = error.code;

  if (isModuleError(code)) {
    return 3;
  }

  if (isReadFileError(code)) {
    return 4;
  }

  if (code === "MODEL_VALIDATION_ERROR" || code.startsWith("MIGRATION_")) {
    return 5;
  }

  if (code.startsWith("ACTION_")) {
    return 6;
  }

  if (code.startsWith("PATCH_")) {
    return 7;
  }

  if (
    code === "MODEL_ALREADY_EXISTS" ||
    code === "MODEL_WRITE_FAILED" ||
    code === "LOG_WRITE_FAILED" ||
    code === "MODEL_LOCKED"
  ) {
    return 8;
  }

  return 1;
}

function isModuleError(code: RpErrorCode): boolean {
  return code === "MODULE_NOT_FOUND" || code === "MODULE_INVALID" || code === "MODULE_MODEL_MISMATCH";
}

function isReadFileError(code: RpErrorCode): boolean {
  return (
    code === "MODEL_NOT_FOUND" ||
    code === "MODEL_INVALID_JSON" ||
    code === "MODEL_ENVELOPE_INVALID" ||
    code === "LOG_READ_FAILED" ||
    code === "LOG_INVALID_JSON"
  );
}
