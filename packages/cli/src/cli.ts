#!/usr/bin/env node
import { Command } from "commander";
import { registerActionCommand } from "./commands/action.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLogCommand } from "./commands/log.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerPatchCommand } from "./commands/patch.js";
import { registerSchemaCommand } from "./commands/schema.js";
import { registerStateCommand } from "./commands/state.js";
import { registerSummaryCommand } from "./commands/summary.js";
import { registerValidateCommand } from "./commands/validate.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("rp")
    .description("Zod-based command line state runtime for AI agents.")
    .version("0.0.0")
    .option("--module <path>", "module file path", "./rp.module.ts")
    .option("--state <path>", "state file path", "./rp.state.json")
    .option("--pretty", "pretty-print JSON output")
    .option("--dry-run", "preview write commands without persisting")
    .option("--reason <text>", "write reason for audit logs");

  registerInitCommand(program);
  registerValidateCommand(program);
  registerMigrateCommand(program);
  registerStateCommand(program);
  registerPatchCommand(program);
  registerActionCommand(program);
  registerSummaryCommand(program);
  registerSchemaCommand(program);
  registerLogCommand(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createProgram().parseAsync(process.argv);
}
