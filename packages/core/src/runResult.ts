import { RpError, type RpErrorCode } from "./errors.js";
import type { RpActionReturn } from "./types.js";

export interface NormalizedRunResult {
  reason?: string;
  result?: unknown;
}

export function normalizeRunResult(
  value: unknown,
  options: { errorCode: RpErrorCode; label: string }
): NormalizedRunResult {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value) || Array.isArray(value)) {
    throw new RpError(options.errorCode, `${options.label} must return { reason?, result? } or undefined`);
  }

  const unknownKeys = Object.keys(value).filter((key) => key !== "reason" && key !== "result");

  if (unknownKeys.length > 0) {
    throw new RpError(options.errorCode, `${options.label} return contains unknown fields`, {
      fields: unknownKeys
    });
  }

  const result = value as Partial<RpActionReturn>;

  if (result.reason !== undefined && typeof result.reason !== "string") {
    throw new RpError(options.errorCode, `${options.label} reason must be a string`);
  }

  return {
    ...(result.reason === undefined ? {} : { reason: result.reason }),
    ...("result" in result ? { result: result.result } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
