import fastJsonPatch from "fast-json-patch";
import { RpError } from "./errors.js";
import type { JsonPatch } from "./types.js";

const STANDARD_PATCH_OPS = new Set(["add", "remove", "replace", "move", "copy", "test"]);

export function assertJsonPatch(patch: unknown): asserts patch is JsonPatch {
  if (!Array.isArray(patch)) {
    throw new RpError("PATCH_INVALID", "JSON Patch must be an array");
  }

  for (const [index, operation] of patch.entries()) {
    if (
      !operation ||
      typeof operation !== "object" ||
      !("op" in operation) ||
      typeof operation.op !== "string" ||
      !STANDARD_PATCH_OPS.has(operation.op)
    ) {
      throw new RpError("PATCH_INVALID", "JSON Patch operation is invalid", {
        index,
        reason: "op must be one of add, remove, replace, move, copy, test"
      });
    }
  }

  const error = fastJsonPatch.validate(patch);

  if (error) {
    throw new RpError("PATCH_INVALID", "JSON Patch is invalid", {
      reason: error.message
    });
  }
}

export function applyJsonPatch<TModel>(model: TModel, patch: JsonPatch): TModel {
  assertJsonPatch(patch);

  try {
    const patchToApply = fastJsonPatch.deepClone(patch) as JsonPatch;

    return fastJsonPatch.applyPatch(model, patchToApply, true, false, true).newDocument;
  } catch (error) {
    throw new RpError("PATCH_FAILED", "failed to apply JSON Patch", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
