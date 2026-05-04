import { toJSONSchema } from "zod";
import { RpError } from "./errors.js";
import type { AnyZodSchema, RpAction, RpModule } from "./types.js";

export function exportModelSchema(module: RpModule): unknown {
  return exportJsonSchema(module.model.schema, "model schema");
}

export function exportActionInputSchema(action: RpAction): unknown {
  return exportJsonSchema(action.input, "action input schema");
}

function exportJsonSchema(schema: AnyZodSchema, description: string): unknown {
  try {
    return toJSONSchema(schema);
  } catch (error) {
    throw new RpError("SCHEMA_EXPORT_FAILED", `failed to export ${description}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
