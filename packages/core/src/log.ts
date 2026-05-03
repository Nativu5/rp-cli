import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
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
