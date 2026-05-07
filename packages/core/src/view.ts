import { RpError } from "./errors.js";
import { cloneMutableModelForUserCode } from "./model.js";
import { normalizeRunResult } from "./validation.js";
import type { RpMeta, RpResult, RpRuntimeContext, RpView, RpViewFunction } from "./types.js";

export function findView(
  views: Record<string, RpView> | undefined,
  requestedName?: string
): { name: string; run: RpViewFunction } {
  const entries = Object.entries(views ?? {});

  if (entries.length === 0) {
    throw new RpError("VIEW_NOT_FOUND", "module does not define views");
  }

  if (requestedName === undefined || requestedName.length === 0) {
    throw new RpError("VIEW_NOT_FOUND", "view name is required");
  }

  const name = requestedName;
  const view = views?.[name];

  if (!name || !view) {
    throw new RpError("VIEW_NOT_FOUND", `view not found: ${requestedName}`);
  }

  if (typeof view === "function") {
    return { name, run: view };
  }

  return { name, run: view.run };
}

export function listViews(views: Record<string, RpView> | undefined): { name: string; description?: string }[] {
  return Object.entries(views ?? {}).map(([name, view]) => {
    if (typeof view === "function" || view.description === undefined) {
      return { name };
    }

    return { name, description: view.description };
  });
}

export async function runView<TModel>(args: {
  view: RpViewFunction<TModel>;
  model: TModel;
  meta: RpMeta;
  ctx: RpRuntimeContext;
}): Promise<RpResult & { model: TModel }> {
  const model = cloneMutableModelForUserCode(args.model);
  let value: unknown;

  try {
    value = await args.view({
      model,
      meta: args.meta,
      ctx: args.ctx
    });
  } catch (error) {
    throw new RpError("VIEW_RUNTIME_ERROR", "view runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    ...normalizeRunResult(value, {
      errorCode: "VIEW_RUNTIME_ERROR",
      label: "view"
    }),
    model
  };
}
