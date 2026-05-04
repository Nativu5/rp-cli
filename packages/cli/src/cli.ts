#!/usr/bin/env node
import { Command } from "commander";
import { registerActionCommand } from "./commands/action.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLogCommand } from "./commands/log.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerModelCommand } from "./commands/model.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerViewCommand } from "./commands/view.js";
import { registerValidateCommand } from "./commands/validate.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("rp")
    .description("Zod-based command line model runtime for AI agents.")
    .version("0.0.0")
    .option("--module <path>", "module file path")
    .option("--model <path>", "model file path")
    .option("--pretty", "pretty-print JSON output")
    .option("--dry-run", "preview write commands without persisting")
    .option("--reason <text>", "write reason for audit logs");

  registerInitCommand(program);
  registerValidateCommand(program);
  registerMigrateCommand(program);
  registerModelCommand(program);
  registerUpdateCommand(program);
  registerActionCommand(program);
  registerViewCommand(program);
  registerLogCommand(program);

  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await createProgram().parseAsync(process.argv);
}
