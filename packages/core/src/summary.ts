import { RpError } from "./errors.js";
import type { RpSummary, RpSummaryFunction } from "./types.js";

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
