import { RpError } from "./errors.js";
import { cloneModelForUserCode } from "./modelAccess.js";
import type { RpMeta, RpView, RpViewFunction } from "./types.js";

export function findView(
  views: Record<string, RpView> | undefined,
  requestedName?: string
): { name: string; run: RpViewFunction } {
  const entries = Object.entries(views ?? {});

  if (entries.length === 0) {
    throw new RpError("VIEW_NOT_FOUND", "module does not define views");
  }

  const name =
    requestedName ?? (views?.default ? "default" : views?.brief ? "brief" : entries[0]?.[0]);
  const view = name ? views?.[name] : undefined;

  if (!name || !view) {
    throw new RpError("VIEW_NOT_FOUND", `view not found: ${requestedName}`);
  }

  if (typeof view === "function") {
    return { name, run: view };
  }

  return { name, run: view.run };
}

export function listViews(
  views: Record<string, RpView> | undefined
): { name: string; description?: string }[] {
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
}): Promise<unknown> {
  try {
    return await args.view({
      model: cloneModelForUserCode(args.model),
      meta: args.meta
    });
  } catch (error) {
    throw new RpError("VIEW_RUNTIME_ERROR", "view runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
