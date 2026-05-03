import { RpError, type RpErrorShape } from "@rp-cli/core";

export function writeJson(value: unknown, pretty = false): void {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

export function toErrorShape(error: unknown): RpErrorShape {
  if (error instanceof RpError) {
    return error.toJSON();
  }

  return {
    error: {
      code: "MODULE_INVALID",
      message: error instanceof Error ? error.message : String(error)
    }
  };
}
