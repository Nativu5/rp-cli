import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as publicCoreApi from "@rp-cli/core";
import * as internalCoreApi from "@rp-cli/core/internal";

describe("architecture contracts", () => {
  it("keeps creator-facing core exports separate from runtime internals", () => {
    expect(Object.keys(publicCoreApi).sort()).toEqual(["defineModule"]);

    for (const runtimeOnlyName of [
      "loadModule",
      "readModelFile",
      "withModelLock",
      "validateModelFile",
      "appendJsonLogEntry",
      "applyJsonPatch"
    ]) {
      expect(runtimeOnlyName in publicCoreApi).toBe(false);
    }
  });

  it("keeps the internal package export focused on CLI runtime operations", () => {
    expect(Object.keys(internalCoreApi).sort()).toEqual([
      "RpError",
      "applyUpdateOperation",
      "exportActionInputSchemaOperation",
      "initModelOperation",
      "listActionSummariesOperation",
      "listViewsOperation",
      "migrateModelOperation",
      "readLogOperation",
      "readModelOperation",
      "resolveRpPaths",
      "runActionOperation",
      "runViewOperation",
      "toErrorShape",
      "validateModelOperation"
    ]);
  });

  it("keeps CLI command modules on the runtime operation surface", async () => {
    const commandDirectory = new URL("../packages/cli/src/commands/", import.meta.url);
    const files = (await readdir(commandDirectory)).filter((file) => file.endsWith(".ts"));
    const allowedImports = new Set([
      "RpError",
      "applyUpdateOperation",
      "exportActionInputSchemaOperation",
      "initModelOperation",
      "listActionSummariesOperation",
      "listViewsOperation",
      "migrateModelOperation",
      "readLogOperation",
      "readModelOperation",
      "runActionOperation",
      "runViewOperation",
      "validateModelOperation"
    ]);
    const offenders: string[] = [];

    for (const file of files) {
      const content = await readFile(new URL(file, commandDirectory), "utf8");
      const importMatches = content.matchAll(/import\s+\{([\s\S]*?)\}\s+from\s+"@rp-cli\/core\/internal"/g);

      for (const match of importMatches) {
        const importedNames = match[1]
          .split(",")
          .map((name) =>
            name
              .trim()
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/)[0]
              ?.trim()
          )
          .filter(Boolean);

        for (const importedName of importedNames) {
          if (!allowedImports.has(importedName)) {
            offenders.push(`${path.join("packages/cli/src/commands", file)} imports ${importedName}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
