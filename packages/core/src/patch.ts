import { validate } from "fast-json-patch";
import { RpError } from "./errors.js";
import type { JsonPatch } from "./types.js";

export function assertJsonPatch(patch: unknown): asserts patch is JsonPatch {
  if (!Array.isArray(patch)) {
    throw new RpError("PATCH_INVALID", "JSON Patch must be an array");
  }

  const error = validate(patch);

  if (error) {
    throw new RpError("PATCH_INVALID", "JSON Patch is invalid", {
      reason: error.message
    });
  }
}
