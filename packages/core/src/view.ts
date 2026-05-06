import { RpError } from "./errors.js";
import { cloneMutableModelForUserCode } from "./model.js";
import type { RpMeta, RpView, RpViewFunction } from "./types.js";

export function findView(
  views: Record<string, RpView> | undefined,
  requestedName?: string
): { name: string; run: RpViewFunction } {
  const entries = Object.entries(views ?? {});

  if (entries.length === 0) {
    throw new RpError("VIEW_NOT_FOUND", "module does not define views");
  }

  if (requestedName !== undefined && requestedName.length === 0) {
    throw new RpError("VIEW_NOT_FOUND", "view name is required");
  }

  const name = requestedName ?? defaultViewName(views ?? {}, entries);
  const view = views?.[name];

  if (!name || !view) {
    throw new RpError("VIEW_NOT_FOUND", `view not found: ${requestedName}`);
  }

  if (typeof view === "function") {
    return { name, run: view };
  }

  return { name, run: view.run };
}

function defaultViewName(views: Record<string, RpView>, entries: [string, RpView][]): string {
  if (views.default) {
    return "default";
  }

  if (views.brief) {
    return "brief";
  }

  return entries[0][0];
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
}): Promise<{ output: unknown; model: TModel }> {
  const model = cloneMutableModelForUserCode(args.model);
  let output: unknown;

  try {
    output = await args.view({
      model,
      meta: args.meta
    });
  } catch (error) {
    throw new RpError("VIEW_RUNTIME_ERROR", "view runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return { output, model };
}
