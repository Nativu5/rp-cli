import { RpError } from "./errors.js";
import type { RpMeta, RpMigration, RpRuntimeContext } from "./types.js";

export type SchemaVersionComparison = "older" | "current" | "newer";

export function compareSchemaVersions(
  fromVersion: number,
  toVersion: number
): SchemaVersionComparison {
  if (fromVersion < toVersion) {
    return "older";
  }

  if (fromVersion > toVersion) {
    return "newer";
  }

  return "current";
}

export function requireMigration<TModel>(
  migrate: RpMigration<TModel> | undefined,
  fromVersion: number,
  toVersion: number
): RpMigration<TModel> {
  const comparison = compareSchemaVersions(fromVersion, toVersion);

  if (comparison === "current") {
    throw new RpError("MIGRATION_FAILED", "migration is not needed", {
      fromVersion,
      toVersion
    });
  }

  if (comparison === "newer") {
    throw new RpError("MIGRATION_FAILED", "cannot migrate from a newer model", {
      fromVersion,
      toVersion
    });
  }

  if (!migrate) {
    throw new RpError("MIGRATION_REQUIRED", "module does not define model.migrate", {
      fromVersion,
      toVersion
    });
  }

  return migrate;
}

export async function runMigration<TModel>(args: {
  migrate: RpMigration<TModel> | undefined;
  model: unknown;
  fromVersion: number;
  toVersion: number;
  meta: RpMeta;
  ctx: RpRuntimeContext;
}): Promise<TModel> {
  const migrate = requireMigration(args.migrate, args.fromVersion, args.toVersion);

  try {
    return await migrate({
      model: args.model,
      fromVersion: args.fromVersion,
      toVersion: args.toVersion,
      meta: args.meta,
      ctx: args.ctx
    });
  } catch (error) {
    throw new RpError("MIGRATION_FAILED", "migration runtime error", {
      cause: error instanceof Error ? error.message : String(error),
      fromVersion: args.fromVersion,
      toVersion: args.toVersion
    });
  }
}
