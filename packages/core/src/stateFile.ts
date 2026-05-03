import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RpError } from "./errors.js";
import { parseEnvelope } from "./validation.js";
import type { RpModule, RpPaths, RpStateFile } from "./types.js";

export const DEFAULT_MODULE_PATH = "./rp.module.ts";
export const DEFAULT_STATE_PATH = "./rp.state.json";

export function resolveRpPaths(options: {
  modulePath?: string;
  statePath?: string;
  cwd?: string;
}): RpPaths {
  const cwd = options.cwd ?? process.cwd();
  const modulePath = path.resolve(
    cwd,
    options.modulePath ?? process.env.RP_MODULE ?? DEFAULT_MODULE_PATH
  );
  const statePath = path.resolve(
    cwd,
    options.statePath ?? process.env.RP_STATE ?? DEFAULT_STATE_PATH
  );

  return {
    modulePath,
    statePath,
    logPath: `${statePath}.log.jsonl`,
    lockPath: `${statePath}.lock`
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
      throw new RpError("STATE_NOT_FOUND", `state file not found: ${filePath}`);
    }

    throw new RpError("STATE_NOT_FOUND", `failed to read state file: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new RpError("STATE_INVALID_JSON", `state file is not valid JSON: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function readStateFile(filePath: string): Promise<RpStateFile> {
  return parseEnvelope(await readJsonFile(filePath));
}

export function createStateEnvelope<TState>(
  module: RpModule<TState>,
  state: TState,
  timestamp = new Date().toISOString()
): RpStateFile<TState> {
  return {
    rp: {
      module: module.name,
      moduleVersion: module.version,
      schemaVersion: module.state.version,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    state
  };
}

export function updateStateEnvelope<TState>(
  envelope: RpStateFile,
  module: RpModule<unknown>,
  state: TState,
  timestamp = new Date().toISOString()
): RpStateFile<TState> {
  return {
    rp: {
      ...envelope.rp,
      module: module.name,
      moduleVersion: module.version,
      schemaVersion: module.state.version,
      updatedAt: timestamp
    },
    state
  };
}

export async function writeJsonFileAtomic(
  filePath: string,
  value: unknown,
  pretty = true
): Promise<void> {
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

    throw new RpError("WRITE_FAILED", `failed to write state file: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function withFileLock<T>(lockPath: string, run: () => Promise<T>): Promise<T> {
  await mkdir(path.dirname(lockPath), { recursive: true });

  let handle;

  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new RpError("STATE_LOCKED", `state file is locked: ${lockPath}`);
    }

    throw new RpError("STATE_LOCKED", `failed to acquire state lock: ${lockPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    await handle.writeFile(
      JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString()
      })
    );

    return await run();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
