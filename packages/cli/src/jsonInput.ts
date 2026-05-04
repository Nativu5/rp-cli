import { readFile } from "node:fs/promises";
import { RpError, type RpErrorCode } from "@rp-cli/core/internal";

export async function readJsonInput(options: {
  inline?: string;
  filePath?: string;
  errorCode: RpErrorCode;
  description: string;
}): Promise<unknown> {
  if (options.inline !== undefined && options.filePath !== undefined) {
    throw new RpError(options.errorCode, `provide either inline ${options.description} JSON or --file, not both`);
  }

  if (options.filePath !== undefined) {
    return readJsonFromFile(options.filePath, options);
  }

  if (options.inline !== undefined) {
    return parseJson(options.inline, options);
  }

  throw new RpError(options.errorCode, `${options.description} JSON is required`);
}

async function readJsonFromFile(
  filePath: string,
  options: {
    errorCode: RpErrorCode;
    description: string;
  }
): Promise<unknown> {
  let content: string;

  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    throw new RpError(options.errorCode, `failed to read ${options.description} file: ${filePath}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return parseJson(content, options);
}

function parseJson(
  content: string,
  options: {
    errorCode: RpErrorCode;
    description: string;
  }
): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new RpError(options.errorCode, `${options.description} JSON is invalid`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
