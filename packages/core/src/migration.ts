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

export function requireMigration<TState>(
  migrate: RpMigration<TState> | undefined,
  fromVersion: number,
  toVersion: number
): RpMigration<TState> {
  const comparison = compareSchemaVersions(fromVersion, toVersion);

  if (comparison === "current") {
    throw new RpError("MIGRATION_FAILED", "migration is not needed", {
      fromVersion,
      toVersion
    });
  }

  if (comparison === "newer") {
    throw new RpError("MIGRATION_FAILED", "cannot migrate from a newer state", {
      fromVersion,
      toVersion
    });
  }

  if (!migrate) {
    throw new RpError("MIGRATION_REQUIRED", "module does not define state.migrate", {
      fromVersion,
      toVersion
    });
  }

  return migrate;
}

export async function runMigration<TState>(args: {
  migrate: RpMigration<TState> | undefined;
  state: unknown;
  fromVersion: number;
  toVersion: number;
  meta: RpMeta;
  ctx: RpRuntimeContext;
}): Promise<TState> {
  const migrate = requireMigration(args.migrate, args.fromVersion, args.toVersion);

  try {
    return await migrate({
      state: args.state,
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
