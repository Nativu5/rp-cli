import { RpError } from "./errors.js";
import type { RpMigration } from "./types.js";

export function requireMigration(
  migrate: RpMigration | undefined,
  fromVersion: number,
  toVersion: number
): RpMigration {
  if (fromVersion === toVersion) {
    throw new RpError("MIGRATION_FAILED", "migration is not needed", {
      fromVersion,
      toVersion
    });
  }

  if (fromVersion > toVersion) {
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
