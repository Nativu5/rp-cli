import { randomUUID } from "node:crypto";
import { RpError } from "./errors.js";
import { assertJsonPatch } from "./patch.js";
import { cloneStateForUserCode } from "./stateAccess.js";
import { formatZodIssues } from "./validation.js";
import type { RpAction, RpActionReturn, RpMeta, RpRuntimeContext } from "./types.js";

export function findAction(actions: Record<string, RpAction> | undefined, name: string): RpAction {
  const action = actions?.[name];

  if (!action) {
    throw new RpError("ACTION_NOT_FOUND", `action not found: ${name}`);
  }

  return action;
}

export function assertActionReturn(value: unknown): asserts value is RpActionReturn {
  if (!value || typeof value !== "object" || !("patch" in value)) {
    throw new RpError("ACTION_RETURN_INVALID", "action must return { patch, reason?, message? }");
  }

  const result = value as Partial<RpActionReturn>;

  if (result.reason !== undefined && typeof result.reason !== "string") {
    throw new RpError("ACTION_RETURN_INVALID", "action reason must be a string");
  }

  if (result.message !== undefined && typeof result.message !== "string") {
    throw new RpError("ACTION_RETURN_INVALID", "action message must be a string");
  }

  try {
    assertJsonPatch(result.patch);
  } catch (error) {
    throw new RpError("ACTION_RETURN_INVALID", "action patch is invalid", {
      cause: error instanceof Error ? error.message : String(error),
      details: error instanceof RpError ? error.details : undefined
    });
  }
}

export function validateActionInput<TInput>(
  action: RpAction<unknown, TInput>,
  input: unknown
): TInput {
  const parsed = action.input.safeParse(input);

  if (!parsed.success) {
    throw new RpError("ACTION_INPUT_INVALID", "action input failed validation", {
      issues: formatZodIssues(parsed.error.issues)
    });
  }

  return parsed.data;
}

export async function runAction<TState, TInput>(args: {
  action: RpAction<TState, TInput>;
  state: TState;
  input: TInput;
  meta: RpMeta;
  ctx: RpRuntimeContext;
}): Promise<RpActionReturn> {
  let value: unknown;

  try {
    value = await args.action.run({
      state: cloneStateForUserCode(args.state),
      input: args.input,
      meta: args.meta,
      ctx: args.ctx
    });
  } catch (error) {
    throw new RpError("ACTION_RUNTIME_ERROR", "action runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  assertActionReturn(value);
  return value;
}

export function createRuntimeContext(): RpRuntimeContext {
  return {
    now: () => new Date().toISOString(),
    id: (prefix?: string) => {
      const id = randomUUID();

      return prefix ? `${prefix}_${id}` : id;
    }
  };
}
