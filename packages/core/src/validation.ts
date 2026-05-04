import { z } from "zod";
import { RpError } from "./errors.js";
import { compareSchemaVersions } from "./migration.js";
import type { RpMeta, RpModule, RpModelFile } from "./types.js";

export const RpMetaSchema = z.object({
  module: z.string().min(1),
  moduleVersion: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const RpModelEnvelopeSchema = z.object({
  rp: RpMetaSchema,
  model: z.unknown()
});

export function parseEnvelope(value: unknown): RpModelFile {
  if (typeof value !== "object" || value === null || !Object.prototype.hasOwnProperty.call(value, "model")) {
    throw new RpError("MODEL_ENVELOPE_INVALID", "model envelope is invalid", {
      issues: ["model field is required"]
    });
  }

  const parsed = RpModelEnvelopeSchema.safeParse(value);

  if (!parsed.success) {
    throw new RpError("MODEL_ENVELOPE_INVALID", "model envelope is invalid", {
      issues: parsed.error.issues
    });
  }

  return {
    rp: parsed.data.rp,
    model: parsed.data.model
  };
}

export function assertCurrentSchemaVersion(meta: RpMeta, module: { model: { version: number } }): void {
  const comparison = compareSchemaVersions(meta.schemaVersion, module.model.version);

  if (comparison === "older") {
    throw new RpError("MIGRATION_REQUIRED", "model schemaVersion is older than module model.version", {
      fromVersion: meta.schemaVersion,
      toVersion: module.model.version
    });
  }

  if (comparison === "newer") {
    throw new RpError("MIGRATION_FAILED", "model schemaVersion is newer than module model.version", {
      fromVersion: meta.schemaVersion,
      toVersion: module.model.version
    });
  }
}

export function assertModuleCompatibility(meta: RpMeta, module: { name: string; version: number }): void {
  if (meta.module !== module.name) {
    throw new RpError("MODULE_MODEL_MISMATCH", "model file belongs to a different module", {
      modelModule: meta.module,
      module: module.name
    });
  }
}

export function validateAuthorModel<TModel>(module: RpModule<TModel>, model: unknown): TModel {
  const parsed = module.model.schema.safeParse(model);

  if (!parsed.success) {
    throw new RpError("VALIDATION_ERROR", "model failed validation", {
      issues: formatZodIssues(parsed.error.issues)
    });
  }

  return parsed.data;
}

export function formatZodIssues(issues: readonly z.core.$ZodIssue[]): {
  path: string;
  message: string;
}[] {
  return issues.map((issue) => ({
    path: issue.path.length === 0 ? "/" : `/${issue.path.map((part) => String(part)).join("/")}`,
    message: issue.message
  }));
}

export function validateModelFile<TModel>(module: RpModule<TModel>, envelope: RpModelFile): RpModelFile<TModel> {
  assertModuleCompatibility(envelope.rp, module);
  assertCurrentSchemaVersion(envelope.rp, module);

  return {
    rp: envelope.rp,
    model: validateAuthorModel(module, envelope.model)
  };
}
