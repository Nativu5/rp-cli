#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync, realpathSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { registerActionCommand } from "./commands/action.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLogCommand } from "./commands/log.js";
import { registerMigrateCommand } from "./commands/migrate.js";
import { registerModelCommand } from "./commands/model.js";
import { registerUpdateCommand } from "./commands/update.js";
import { registerViewCommand } from "./commands/view.js";
import { registerValidateCommand } from "./commands/validate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

export function createProgram(): Command {
  const program = new Command();

  program
    .name("rp")
    .description("Roleplaying CLI based on Zod and Model-View-Update pattern")
    .version(pkg.version)
    .option("--module <path>", 'module file path ("rp.module.ts" or "rp.module.js")')
    .option("--model <path>", 'model file path ("rp.model.json")')
    .option("--pretty", "pretty-print JSON output")
    .option("--dry-run", "preview commands without persisting")
    .option("--reason <text>", "write reason for logs");

  registerInitCommand(program);
  registerValidateCommand(program);
  registerMigrateCommand(program);
  registerModelCommand(program);
  registerUpdateCommand(program);
  registerActionCommand(program);
  registerViewCommand(program);
  registerLogCommand(program);

  program.addHelpText(
    "afterAll",
    `\nNote:
- Prefer using the 'action' and 'view' over 'update' and 'model' commands for most use cases.
- Providing --reason is recommended for better context, but not required.`
  );

  return program;
}

export function isDirectCliExecution(argvEntry: string | undefined): boolean {
  if (!argvEntry) {
    return false;
  }

  try {
    return realpathSync(__filename) === realpathSync(argvEntry);
  } catch {
    return false;
  }
}

if (isDirectCliExecution(process.argv[1])) {
  await createProgram().parseAsync(process.argv);
}
