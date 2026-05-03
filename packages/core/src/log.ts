import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RpError } from "./errors.js";

export function hashState(value: unknown): string {
  const json = JSON.stringify(value);
  const digest = createHash("sha256").update(json).digest("hex");

  return `sha256:${digest}`;
}

export async function appendJsonLogEntry(
  logPath: string,
  entry: Record<string, unknown>
): Promise<void> {
  try {
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (error) {
    throw new RpError("LOG_WRITE_FAILED", `failed to append log file: ${logPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function readJsonLogEntries(logPath: string): Promise<unknown[]> {
  let content: string;

  try {
    content = await readFile(logPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw new RpError("STATE_NOT_FOUND", `failed to read log file: ${logPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  try {
    return lines.map((line) => JSON.parse(line));
  } catch (error) {
    throw new RpError("STATE_INVALID_JSON", `log file is not valid JSONL: ${logPath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
