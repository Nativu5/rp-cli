import { z } from "zod";
import { RpError } from "./errors.js";
import type { RpMeta, RpModule, RpStateFile } from "./types.js";

export const RpMetaSchema = z.object({
  module: z.string().min(1),
  moduleVersion: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RpStateEnvelopeSchema = z.object({
  rp: RpMetaSchema,
  state: z.unknown()
});

export function parseEnvelope(value: unknown): RpStateFile {
  if (
    typeof value !== "object" ||
    value === null ||
    !Object.prototype.hasOwnProperty.call(value, "state")
  ) {
    throw new RpError("STATE_ENVELOPE_INVALID", "state envelope is invalid", {
      issues: ["state field is required"]
    });
  }

  const parsed = RpStateEnvelopeSchema.safeParse(value);

  if (!parsed.success) {
    throw new RpError("STATE_ENVELOPE_INVALID", "state envelope is invalid", {
      issues: parsed.error.issues
    });
  }

  return {
    rp: parsed.data.rp,
    state: parsed.data.state
  };
}

export function assertCurrentSchemaVersion(
  meta: RpMeta,
  module: { state: { version: number } }
): void {
  if (meta.schemaVersion < module.state.version) {
    throw new RpError(
      "MIGRATION_REQUIRED",
      "state schemaVersion is older than module state.version",
      { fromVersion: meta.schemaVersion, toVersion: module.state.version }
    );
  }

  if (meta.schemaVersion > module.state.version) {
    throw new RpError(
      "MIGRATION_FAILED",
      "state schemaVersion is newer than module state.version",
      { fromVersion: meta.schemaVersion, toVersion: module.state.version }
    );
  }
}

export function validateAuthorState<TState>(
  module: RpModule<TState>,
  state: unknown
): TState {
  const parsed = module.state.schema.safeParse(state);

  if (!parsed.success) {
    throw new RpError("VALIDATION_ERROR", "state failed validation", {
      issues: parsed.error.issues.map((issue) => ({
        path:
          issue.path.length === 0
            ? "/"
            : `/${issue.path.map((part) => String(part)).join("/")}`,
        message: issue.message
      }))
    });
  }

  return parsed.data;
}

export function validateStateFile<TState>(
  module: RpModule<TState>,
  envelope: RpStateFile
): RpStateFile<TState> {
  assertCurrentSchemaVersion(envelope.rp, module);

  return {
    rp: envelope.rp,
    state: validateAuthorState(module, envelope.state)
  };
}
