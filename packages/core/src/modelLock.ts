import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { RpError } from "./errors.js";
import type { RpPaths } from "./types.js";
import type * as ProperLockfile from "proper-lockfile";

const require = createRequire(import.meta.url);
const lockfile = require("proper-lockfile") as typeof ProperLockfile;

export const DEFAULT_LOCK_STALE_MS = 5_000;
export const DEFAULT_LOCK_UPDATE_MS = 1_000;

export async function withModelLock<T>(paths: RpPaths, run: () => Promise<T>): Promise<T> {
  await mkdir(path.dirname(paths.lockPath), { recursive: true });

  let release: (() => Promise<void>) | undefined;

  try {
    release = await lockfile.lock(paths.modelPath, {
      lockfilePath: paths.lockPath,
      realpath: false,
      stale: DEFAULT_LOCK_STALE_MS,
      update: DEFAULT_LOCK_UPDATE_MS,
      retries: {
        retries: 8,
        factor: 1.2,
        minTimeout: 20,
        maxTimeout: 80
      }
    });
  } catch (error) {
    throw modelLockedError(paths.lockPath, "failed to acquire model lock", error);
  }

  let result: T;

  try {
    result = await run();
  } catch (error) {
    await releaseModelLockIgnoringErrors(release);
    throw error;
  }

  await releaseModelLock(paths.lockPath, release);
  return result;
}

function modelLockedError(lockPath: string, message: string, error: unknown): RpError {
  return new RpError("MODEL_LOCKED", `${message}: ${lockPath}`, {
    cause: error instanceof Error ? error.message : String(error),
    code: isNodeError(error) ? error.code : undefined
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function releaseModelLock(lockPath: string, release: () => Promise<void>): Promise<void> {
  try {
    await release();
  } catch (error) {
    throw modelLockedError(lockPath, "failed to release model lock", error);
  }
}

async function releaseModelLockIgnoringErrors(release: () => Promise<void>): Promise<void> {
  try {
    await release();
  } catch {
    // Preserve the original command error. A release failure after a command failure is secondary.
  }
}
