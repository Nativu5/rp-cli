import { randomUUID } from "node:crypto";
import { RpError } from "./errors.js";
import { cloneMutableModelForUserCode } from "./model.js";
import { normalizeRunResult, type NormalizedRunResult } from "./runResult.js";
import { formatZodIssues } from "./validation.js";
import type { RpAction, RpMeta, RpRuntimeContext } from "./types.js";

export function findAction(actions: Record<string, RpAction> | undefined, name: string): RpAction {
  const action = actions?.[name];

  if (!action) {
    throw new RpError("ACTION_NOT_FOUND", `action not found: ${name}`);
  }

  return action;
}

export function validateActionInput<TInput>(action: RpAction<unknown, TInput>, input: unknown): TInput {
  const parsed = action.input.safeParse(input);

  if (!parsed.success) {
    throw new RpError("ACTION_INPUT_INVALID", "action input failed validation", {
      issues: formatZodIssues(parsed.error.issues)
    });
  }

  return parsed.data;
}

export async function runAction<TModel, TInput>(args: {
  action: RpAction<TModel, TInput>;
  model: TModel;
  input: TInput;
  meta: RpMeta;
  ctx: RpRuntimeContext;
}): Promise<NormalizedRunResult & { model: TModel }> {
  const model = cloneMutableModelForUserCode(args.model);
  let value: unknown;

  try {
    value = await args.action.run({
      model,
      input: args.input,
      meta: args.meta,
      ctx: args.ctx
    });
  } catch (error) {
    throw new RpError("ACTION_RUNTIME_ERROR", "action runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    ...normalizeRunResult(value, {
      errorCode: "ACTION_RETURN_INVALID",
      label: "action"
    }),
    model
  };
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
