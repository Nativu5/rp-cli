import { toErrorShape as formatErrorShape, type RpErrorShape } from "@rp-cli/core/internal";

export type OutputMode = "default" | "json";

export interface ResultEnvelope {
  result?: unknown;
}

export interface ListItem {
  name: string;
  description?: string;
}

export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function writeList(items: ListItem[], output: OutputMode): void {
  if (output === "json") {
    writeJson(items);
    return;
  }

  process.stdout.write(`${items.map(formatListItem).join("\n")}\n`);
}

export function writeResult(envelope: ResultEnvelope, output: OutputMode): void {
  if (output === "json") {
    writeJson(envelope);
    return;
  }

  if (!("result" in envelope) || envelope.result === undefined) {
    return;
  }

  if (typeof envelope.result === "string") {
    process.stdout.write(`${envelope.result}\n`);
    return;
  }

  writeJson(envelope.result);
}

export function toErrorShape(error: unknown): RpErrorShape {
  return formatErrorShape(error);
}

function formatListItem(item: ListItem): string {
  if (item.description === undefined) {
    return item.name;
  }

  return `${item.name}: ${item.description}`;
}
