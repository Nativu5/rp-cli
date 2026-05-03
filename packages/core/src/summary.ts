import { RpError } from "./errors.js";
import type { RpMeta, RpSummary, RpSummaryFunction } from "./types.js";

export function findSummary(
  summaries: Record<string, RpSummary> | undefined,
  requestedName?: string
): { name: string; run: RpSummaryFunction } {
  const entries = Object.entries(summaries ?? {});

  if (entries.length === 0) {
    throw new RpError("SUMMARY_NOT_FOUND", "module does not define summaries");
  }

  const name =
    requestedName ??
    (summaries?.default ? "default" : summaries?.brief ? "brief" : entries[0]?.[0]);
  const summary = name ? summaries?.[name] : undefined;

  if (!name || !summary) {
    throw new RpError("SUMMARY_NOT_FOUND", `summary not found: ${requestedName}`);
  }

  if (typeof summary === "function") {
    return { name, run: summary };
  }

  return { name, run: summary.run };
}

export function listSummaries(
  summaries: Record<string, RpSummary> | undefined
): { name: string; description?: string }[] {
  return Object.entries(summaries ?? {}).map(([name, summary]) => {
    if (typeof summary === "function" || summary.description === undefined) {
      return { name };
    }

    return { name, description: summary.description };
  });
}

export async function runSummary<TState>(args: {
  summary: RpSummaryFunction<TState>;
  state: TState;
  meta: RpMeta;
}): Promise<unknown> {
  try {
    return await args.summary({
      state: args.state,
      meta: args.meta
    });
  } catch (error) {
    throw new RpError("SUMMARY_RUNTIME_ERROR", "summary runtime error", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
