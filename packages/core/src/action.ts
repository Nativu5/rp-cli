import { RpError } from "./errors.js";
import type { RpAction, RpActionReturn } from "./types.js";

export function findAction(
  actions: Record<string, RpAction> | undefined,
  name: string
): RpAction {
  const action = actions?.[name];

  if (!action) {
    throw new RpError("ACTION_NOT_FOUND", `action not found: ${name}`);
  }

  return action;
}

export function assertActionReturn(value: unknown): asserts value is RpActionReturn {
  if (!value || typeof value !== "object" || !("patch" in value)) {
    throw new RpError(
      "ACTION_RETURN_INVALID",
      "action must return { patch, reason?, message? }"
    );
  }

  const result = value as Partial<RpActionReturn>;

  if (result.reason !== undefined && typeof result.reason !== "string") {
    throw new RpError("ACTION_RETURN_INVALID", "action reason must be a string");
  }

  if (result.message !== undefined && typeof result.message !== "string") {
    throw new RpError("ACTION_RETURN_INVALID", "action message must be a string");
  }
}
