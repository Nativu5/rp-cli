import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseModule } from "./moduleParser.js";
import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

export async function loadModule(modulePath: string): Promise<RpModule> {
  let loaded: unknown;

  try {
    await access(modulePath);
  } catch (error) {
    throw new RpError("MODULE_NOT_FOUND", `module not found: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    loaded = await import(pathToFileURL(modulePath).href);
  } catch (error) {
    if (error instanceof RpError) {
      throw error;
    }

    throw new RpError("MODULE_INVALID", `failed to load module: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  const candidate = (loaded as { default?: unknown }).default;

  if (!candidate || typeof candidate !== "object") {
    throw new RpError("MODULE_INVALID", "module must export a default RP module");
  }

  return parseModule(candidate);
}
