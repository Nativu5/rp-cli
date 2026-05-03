export type RpErrorCode =
  | "MODULE_NOT_FOUND"
  | "MODULE_INVALID"
  | "STATE_NOT_FOUND"
  | "STATE_INVALID_JSON"
  | "STATE_ENVELOPE_INVALID"
  | "VALIDATION_ERROR"
  | "PATCH_INVALID"
  | "PATCH_FAILED"
  | "ACTION_NOT_FOUND"
  | "ACTION_INPUT_INVALID"
  | "ACTION_RETURN_INVALID"
  | "ACTION_RUNTIME_ERROR"
  | "SUMMARY_NOT_FOUND"
  | "SUMMARY_RUNTIME_ERROR"
  | "MIGRATION_REQUIRED"
  | "MIGRATION_FAILED"
  | "SCHEMA_EXPORT_FAILED"
  | "WRITE_FAILED"
  | "LOG_WRITE_FAILED"
  | "STATE_LOCKED";

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
