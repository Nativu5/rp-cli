import type { Command } from "commander";
import { readJsonLogEntries, RpError } from "@rp-cli/core/internal";
import { runCommand } from "../commandRunner.js";
import { writeJson } from "../output.js";

export function registerLogCommand(program: Command): void {
  program
    .command("log")
    .description("Read operation logs.")
    .option("--limit <count>", "number of log entries to output")
    .action(async (options: { limit?: string }, command) => {
      await runCommand(command, async ({ paths, pretty }) => {
        const entries = await readJsonLogEntries(paths.logPath);
        const limit = parseLimit(options.limit);

        writeJson(limit === undefined ? entries : entries.slice(-limit), pretty);
      });
    });
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 0) {
    throw new RpError("MODEL_INVALID_JSON", "log limit must be a non-negative integer");
  }

  return limit;
}
