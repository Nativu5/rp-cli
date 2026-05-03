import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

export function parseModule(value: unknown): RpModule {
  const issues = validateModuleShape(value);

  if (issues.length > 0) {
    throw new RpError("MODULE_INVALID", "module definition is invalid", {
      issues
    });
  }

  return value as RpModule;
}

function validateModuleShape(value: unknown): string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return ["module must be an object"];
  }

  if (!isNonEmptyString(value.name)) {
    issues.push("name must be a non-empty string");
  }

  if (!isVersion(value.version)) {
    issues.push("version must be a non-negative integer");
  }

  if (!isRecord(value.state)) {
    issues.push("state must be an object");
    return issues;
  }

  if (!isVersion(value.state.version)) {
    issues.push("state.version must be a non-negative integer");
  }

  if (!isZodType(value.state.schema)) {
    issues.push("state.schema must be a Zod schema");
  }

  if (typeof value.state.defaults !== "function") {
    issues.push("state.defaults must be a function");
  }

  if (
    value.state.migrate !== undefined &&
    typeof value.state.migrate !== "function"
  ) {
    issues.push("state.migrate must be a function when provided");
  }

  if (value.actions !== undefined) {
    validateActions(value.actions, issues);
  }

  if (value.summaries !== undefined) {
    validateSummaries(value.summaries, issues);
  }

  return issues;
}

function validateActions(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("actions must be an object when provided");
    return;
  }

  for (const [name, action] of Object.entries(value)) {
    if (!isRecord(action)) {
      issues.push(`actions.${name} must be an object`);
      continue;
    }

    if (!isNonEmptyString(action.description)) {
      issues.push(`actions.${name}.description must be a non-empty string`);
    }

    if (!isZodType(action.input)) {
      issues.push(`actions.${name}.input must be a Zod schema`);
    }

    if (typeof action.run !== "function") {
      issues.push(`actions.${name}.run must be a function`);
    }
  }
}

function validateSummaries(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("summaries must be an object when provided");
    return;
  }

  for (const [name, summary] of Object.entries(value)) {
    if (typeof summary === "function") {
      continue;
    }

    if (!isRecord(summary)) {
      issues.push(`summaries.${name} must be a function or object`);
      continue;
    }

    if (
      summary.description !== undefined &&
      !isNonEmptyString(summary.description)
    ) {
      issues.push(`summaries.${name}.description must be a non-empty string`);
    }

    if (typeof summary.run !== "function") {
      issues.push(`summaries.${name}.run must be a function`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isZodType(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.parse === "function" &&
    typeof value.safeParse === "function"
  );
}
