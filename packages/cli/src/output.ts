import {
  toErrorShape as formatErrorShape,
  type RpErrorShape
} from "@rp-cli/core/internal";

export function writeJson(value: unknown, pretty = false): void {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

export function toErrorShape(error: unknown): RpErrorShape {
  return formatErrorShape(error);
}
