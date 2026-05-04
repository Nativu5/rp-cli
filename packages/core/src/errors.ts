export type RpErrorCode =
  | "MODULE_NOT_FOUND"
  | "MODULE_INVALID"
  | "MODULE_MODEL_MISMATCH"
  | "MODEL_NOT_FOUND"
  | "MODEL_INVALID_JSON"
  | "MODEL_ENVELOPE_INVALID"
  | "VALIDATION_ERROR"
  | "PATCH_INVALID"
  | "PATCH_FAILED"
  | "ACTION_NOT_FOUND"
  | "ACTION_INPUT_INVALID"
  | "ACTION_RETURN_INVALID"
  | "ACTION_RUNTIME_ERROR"
  | "VIEW_NOT_FOUND"
  | "VIEW_RUNTIME_ERROR"
  | "MIGRATION_REQUIRED"
  | "MIGRATION_FAILED"
  | "SCHEMA_EXPORT_FAILED"
  | "WRITE_FAILED"
  | "LOG_WRITE_FAILED"
  | "MODEL_LOCKED";

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

export function toErrorShape(error: unknown, fallbackCode: RpErrorCode = "MODULE_INVALID"): RpErrorShape {
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
