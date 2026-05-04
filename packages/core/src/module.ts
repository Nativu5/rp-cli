import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------

export const SUPPORTED_MODULE_EXTENSIONS = [".ts", ".mts", ".js", ".mjs", ".cjs"] as const;

export async function loadModule(modulePath: string): Promise<RpModule> {
  let loaded: unknown;

  try {
    await access(modulePath);
  } catch (error) {
    throw new RpError("MODULE_NOT_FOUND", `module not found: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  assertModuleExt(modulePath);

  try {
    loaded = await import(pathToFileURL(modulePath).href);
  } catch (error) {
    if (error instanceof RpError) {
      throw error;
    }

    throw new RpError("MODULE_INVALID", `failed to load module: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const candidate = (loaded as { default?: unknown }).default;

  if (!candidate || typeof candidate !== "object") {
    throw new RpError("MODULE_INVALID", "module must export a default RP module");
  }

  return parseModule(candidate);
}

function assertModuleExt(modulePath: string): void {
  const extension = path.extname(modulePath);

  if (SUPPORTED_MODULE_EXTENSIONS.includes(extension as (typeof SUPPORTED_MODULE_EXTENSIONS)[number])) {
    return;
  }

  throw new RpError("MODULE_INVALID", `unsupported module file extension: ${extension || "(none)"}`, {
    extension,
    supportedExtensions: [...SUPPORTED_MODULE_EXTENSIONS]
  });
}

// ---------------------------------------------------------------------------
// Module parsing / validation
// ---------------------------------------------------------------------------

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

  if (Object.prototype.hasOwnProperty.call(value, "state")) {
    issues.push("state has been renamed to model");
  }

  if (Object.prototype.hasOwnProperty.call(value, "summaries")) {
    issues.push("summaries has been renamed to views");
  }

  if (!isRecord(value.model)) {
    issues.push("model must be an object");
    return issues;
  }

  if (!isVersion(value.model.version)) {
    issues.push("model.version must be a non-negative integer");
  }

  if (!isZodType(value.model.schema)) {
    issues.push("model.schema must be a Zod schema");
  }

  if (typeof value.model.defaults !== "function") {
    issues.push("model.defaults must be a function");
  }

  if (value.model.migrate !== undefined && typeof value.model.migrate !== "function") {
    issues.push("model.migrate must be a function when provided");
  }

  if (value.actions !== undefined) {
    validateActions(value.actions, issues);
  }

  if (value.views !== undefined) {
    validateViews(value.views, issues);
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

function validateViews(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("views must be an object when provided");
    return;
  }

  for (const [name, view] of Object.entries(value)) {
    if (typeof view === "function") {
      continue;
    }

    if (!isRecord(view)) {
      issues.push(`views.${name} must be a function or object`);
      continue;
    }

    if (view.description !== undefined && !isNonEmptyString(view.description)) {
      issues.push(`views.${name}.description must be a non-empty string`);
    }

    if (typeof view.run !== "function") {
      issues.push(`views.${name}.run must be a function`);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  return isRecord(value) && typeof value.parse === "function" && typeof value.safeParse === "function";
}
