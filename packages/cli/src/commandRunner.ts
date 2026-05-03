import type { Command } from "commander";
import { RpError, resolveRpPaths, type RpErrorCode, type RpPaths } from "@rp-cli/core/internal";
import { toErrorShape, writeJson } from "./output.js";

export interface GlobalCliOptions {
  module?: string;
  state?: string;
  pretty?: boolean;
  dryRun?: boolean;
  reason?: string;
}

export interface CommandContext {
  paths: RpPaths;
  pretty: boolean;
  dryRun: boolean;
  reason?: string;
}

export async function runCommand(
  command: Command,
  run: (ctx: CommandContext) => Promise<void>
): Promise<void> {
  const options = command.optsWithGlobals<GlobalCliOptions>();
  const context: CommandContext = {
    paths: resolveRpPaths({
      modulePath: options.module,
      statePath: options.state
    }),
    pretty: Boolean(options.pretty),
    dryRun: Boolean(options.dryRun),
    reason: options.reason
  };

  try {
    await run(context);
  } catch (error) {
    writeJson(toErrorShape(error), context.pretty);
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

  if (isStateFileError(code)) {
    return 4;
  }

  if (code === "VALIDATION_ERROR" || code.startsWith("MIGRATION_")) {
    return 5;
  }

  if (code.startsWith("ACTION_")) {
    return 6;
  }

  if (code.startsWith("PATCH_")) {
    return 7;
  }

  if (code === "WRITE_FAILED" || code === "LOG_WRITE_FAILED" || code === "STATE_LOCKED") {
    return 8;
  }

  return 1;
}

function isModuleError(code: RpErrorCode): boolean {
  return code === "MODULE_NOT_FOUND" || code === "MODULE_INVALID";
}

function isStateFileError(code: RpErrorCode): boolean {
  return (
    code === "STATE_NOT_FOUND" || code === "STATE_INVALID_JSON" || code === "STATE_ENVELOPE_INVALID"
  );
}
