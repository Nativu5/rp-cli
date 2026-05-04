import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RpError } from "./errors.js";
import { parseEnvelope } from "./validation.js";
import type { RpModule, RpPaths, RpModelFile } from "./types.js";

export const DEFAULT_MODULE_PATH = "./rp.module.ts";
export const DEFAULT_MODEL_PATH = "./rp.model.json";

export function resolveRpPaths(options: { modulePath?: string; modelPath?: string; cwd?: string }): RpPaths {
  const cwd = options.cwd ?? process.cwd();
  const modulePath = path.resolve(cwd, options.modulePath ?? process.env.RP_MODULE ?? DEFAULT_MODULE_PATH);
  const modelPath = path.resolve(cwd, options.modelPath ?? process.env.RP_MODEL ?? DEFAULT_MODEL_PATH);

  return {
    modulePath,
    modelPath,
    logPath: `${modelPath}.log.jsonl`,
    lockPath: `${modelPath}.lock`
  };
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  let content: string;

  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new RpError("MODEL_NOT_FOUND", `model file not found: ${filePath}`);
    }

    throw new RpError("MODEL_NOT_FOUND", `failed to read model file: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new RpError("MODEL_INVALID_JSON", `model file is not valid JSON: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function readModelFile(filePath: string): Promise<RpModelFile> {
  return parseEnvelope(await readJsonFile(filePath));
}

export function createModelEnvelope<TModel>(
  module: RpModule<TModel>,
  model: TModel,
  timestamp = new Date().toISOString()
): RpModelFile<TModel> {
  return {
    rp: {
      module: module.name,
      moduleVersion: module.version,
      schemaVersion: module.model.version,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    model
  };
}

export function updateModelEnvelope<TModel>(
  envelope: RpModelFile,
  module: RpModule<unknown>,
  model: TModel,
  timestamp = new Date().toISOString()
): RpModelFile<TModel> {
  return {
    rp: {
      ...envelope.rp,
      module: module.name,
      moduleVersion: module.version,
      schemaVersion: module.model.version,
      updatedAt: timestamp
    },
    model
  };
}

export async function writeJsonFileAtomic(filePath: string, value: unknown, pretty = true): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`
  );

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });

    throw new RpError("WRITE_FAILED", `failed to write model file: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
