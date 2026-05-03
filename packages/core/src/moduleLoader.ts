import { pathToFileURL } from "node:url";
import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

export async function loadModule(modulePath: string): Promise<RpModule> {
  let loaded: unknown;

  try {
    loaded = await import(pathToFileURL(modulePath).href);
  } catch (error) {
    throw new RpError("MODULE_NOT_FOUND", `module not found: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const candidate = (loaded as { default?: unknown }).default;

  if (!candidate || typeof candidate !== "object") {
    throw new RpError("MODULE_INVALID", "module must export a default RP module");
  }

  return candidate as RpModule;
}
