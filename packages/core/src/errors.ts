export type RpErrorCode =
  // Module definition and local module loading.
  | "MODULE_NOT_FOUND"
  | "MODULE_INVALID"
  | "MODULE_MODEL_MISMATCH"
  // Persisted model file IO, envelope parsing, compatibility, validation, and locking.
  | "MODEL_NOT_FOUND"
  | "MODEL_INVALID_JSON"
  | "MODEL_ENVELOPE_INVALID"
  | "MODEL_VALIDATION_ERROR"
  | "MODEL_ALREADY_EXISTS"
  | "MODEL_WRITE_FAILED"
  | "MODEL_LOCKED"
  // JSON Patch syntax and application failures.
  | "PATCH_INVALID"
  | "PATCH_FAILED"
  // Creator-defined action discovery, input, return value, and runtime failures.
  | "ACTION_NOT_FOUND"
  | "ACTION_INPUT_INVALID"
  | "ACTION_RETURN_INVALID"
  | "ACTION_RUNTIME_ERROR"
  // Creator-defined read-only view discovery and runtime failures.
  | "VIEW_NOT_FOUND"
  | "VIEW_RUNTIME_ERROR"
  // Model schema version migration policy and execution failures.
  | "MIGRATION_REQUIRED"
  | "MIGRATION_FAILED"
  // Zod JSON Schema export used by model/action schema discovery.
  | "SCHEMA_EXPORT_FAILED"
  // Audit log read/write and command input failures.
  | "LOG_READ_FAILED"
  | "LOG_INVALID_JSON"
  | "LOG_LIMIT_INVALID"
  | "LOG_WRITE_FAILED"
  // Generic fallback for unexpected non-RpError failures.
  | "INTERNAL_ERROR";

export interface RpErrorShape {
  error: {
    code: RpErrorCode;
    message: string;
    details?: unknown;
  };
}

export class RpError extends Error {
  readonly code: RpErrorCode;
  readonly details?: unknown;

  constructor(code: RpErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "RpError";
    this.code = code;
    this.details = details;
  }

  toJSON(): RpErrorShape {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details })
      }
    };
  }
}

export function toErrorShape(error: unknown, fallbackCode: RpErrorCode = "INTERNAL_ERROR"): RpErrorShape {
  if (error instanceof RpError) {
    return error.toJSON();
  }

  return {
    error: {
      code: fallbackCode,
      message: error instanceof Error ? error.message : String(error)
    }
  };
}
