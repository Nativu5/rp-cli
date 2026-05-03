import { toJSONSchema } from "zod";
import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

export function exportStateSchema(module: RpModule): unknown {
  try {
    return toJSONSchema(module.state.schema);
  } catch (error) {
    throw new RpError("SCHEMA_EXPORT_FAILED", "failed to export state schema", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
