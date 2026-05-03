import { z } from "zod";
import { RpError } from "./errors.js";
import type { RpMeta, RpModule, RpStateFile } from "./types.js";

export const RpMetaSchema = z.object({
  module: z.string(),
  moduleVersion: z.number(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const RpStateEnvelopeSchema = z.object({
  rp: RpMetaSchema,
  state: z.unknown()
});

export function parseEnvelope(value: unknown): RpStateFile {
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
  module: RpModule
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
