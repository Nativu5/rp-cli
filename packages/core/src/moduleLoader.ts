import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseModule } from "./moduleParser.js";
import { RpError } from "./errors.js";
import type { RpModule } from "./types.js";

export const SUPPORTED_MODULE_EXTENSIONS = [".ts", ".mts", ".js", ".mjs", ".cjs"] as const;

export async function loadModule(modulePath: string): Promise<RpModule> {
  let loaded: unknown;

  try {
    await access(modulePath);
  } catch (error) {
    throw new RpError("MODULE_NOT_FOUND", `module not found: ${modulePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  assertSupportedModuleExtension(modulePath);

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

function assertSupportedModuleExtension(modulePath: string): void {
  const extension = path.extname(modulePath);

  if (
    SUPPORTED_MODULE_EXTENSIONS.includes(extension as (typeof SUPPORTED_MODULE_EXTENSIONS)[number])
  ) {
    return;
  }

  throw new RpError(
    "MODULE_INVALID",
    `unsupported module file extension: ${extension || "(none)"}`,
    {
      extension,
      supportedExtensions: [...SUPPORTED_MODULE_EXTENSIONS]
    }
  );
}
