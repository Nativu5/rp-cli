import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import * as publicCoreApi from "@rp-cli/core";
import { defineModule } from "@rp-cli/core";
import { resolveRpPaths } from "@rp-cli/core/internal";
import { z } from "zod";
import { createProgram } from "../packages/cli/src/cli.js";

describe("scaffold", () => {
  it("exports defineModule from core", () => {
    const module = defineModule({
      name: "test",
      version: 1,
      state: {
        version: 1,
        schema: z.object({ value: z.string() }),
        defaults: () => ({ value: "ready" })
      }
    });

    expect(module.name).toBe("test");
    expect(module.state.version).toBe(1);
  });

  it("resolves default runtime paths", () => {
    const paths = resolveRpPaths({ cwd: "/tmp/rp-cli-test" });

    expect(paths.modulePath).toBe("/tmp/rp-cli-test/rp.module.ts");
    expect(paths.statePath).toBe("/tmp/rp-cli-test/rp.state.json");
    expect(paths.logPath).toBe("/tmp/rp-cli-test/rp.state.json.log.jsonl");
    expect(paths.lockPath).toBe("/tmp/rp-cli-test/rp.state.json.lock");
  });

  it("registers the planned CLI commands", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name()).sort();

    expect(commandNames).toEqual([
      "action",
      "init",
      "log",
      "migrate",
      "patch",
      "schema",
      "state",
      "summary",
      "validate"
    ]);
  });

  it("uses --list on action and summary for capability discovery", () => {
    const program = createProgram();
    const actionCommand = program.commands.find((command) => command.name() === "action");
    const summaryCommand = program.commands.find((command) => command.name() === "summary");

    expect(actionCommand?.options.some((option) => option.long === "--list")).toBe(true);
    expect(summaryCommand?.options.some((option) => option.long === "--list")).toBe(true);
  });

  it("keeps runtime-only APIs out of the public creator API", () => {
    expect("parseModule" in publicCoreApi).toBe(false);
    expect("loadModule" in publicCoreApi).toBe(false);
    expect("readStateFile" in publicCoreApi).toBe(false);
  });

  it("declares the Node runtime expected by TypeScript module loading", async () => {
    const packageJsons = await Promise.all(
      ["../package.json", "../packages/core/package.json", "../packages/cli/package.json"].map(
        async (filePath) => JSON.parse(await readFile(new URL(filePath, import.meta.url), "utf8"))
      )
    );

    for (const packageJson of packageJsons) {
      expect(packageJson.engines).toEqual({
        node: ">=24.0.0"
      });
    }
  });
});
