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
      model: {
        version: 1,
        schema: z.object({ value: z.string() }),
        defaults: () => ({ value: "ready" })
      }
    });

    expect(module.name).toBe("test");
    expect(module.model.version).toBe(1);
  });

  it("resolves default runtime paths", () => {
    const paths = resolveRpPaths({ cwd: "/tmp/rp-cli-test" });

    expect(paths.modulePath).toBe("/tmp/rp-cli-test/rp.module.ts");
    expect(paths.modelPath).toBe("/tmp/rp-cli-test/rp.model.json");
    expect(paths.logPath).toBe("/tmp/rp-cli-test/rp.model.json.log.jsonl");
    expect(paths.lockPath).toBe("/tmp/rp-cli-test/rp.model.json.lock");
  });

  it("registers the planned CLI commands", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name()).sort();

    expect(commandNames).toEqual([
      "action",
      "init",
      "log",
      "migrate",
      "model",
      "update",
      "validate",
      "view"
    ]);
  });

  it("uses --list on action and view for capability discovery", () => {
    const program = createProgram();
    const actionCommand = program.commands.find((command) => command.name() === "action");
    const viewCommand = program.commands.find((command) => command.name() === "view");

    expect(actionCommand?.options.some((option) => option.long === "--list")).toBe(true);
    expect(viewCommand?.options.some((option) => option.long === "--list")).toBe(true);
  });

  it("exposes schema discovery on model and action commands", () => {
    const program = createProgram();
    const modelCommand = program.commands.find((command) => command.name() === "model");
    const actionCommand = program.commands.find((command) => command.name() === "action");

    expect(modelCommand?.options.some((option) => option.long === "--schema")).toBe(true);
    expect(actionCommand?.options.some((option) => option.long === "--schema")).toBe(true);
    expect(program.commands.some((command) => command.name() === "schema")).toBe(false);
  });

  it("does not register removed command aliases", () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).not.toContain("state");
    expect(commandNames).not.toContain("summary");
    expect(commandNames).not.toContain("patch");
    expect(commandNames).not.toContain("schema");
  });

  it("keeps runtime-only APIs out of the public creator API", () => {
    expect("parseModule" in publicCoreApi).toBe(false);
    expect("loadModule" in publicCoreApi).toBe(false);
    expect("readModelFile" in publicCoreApi).toBe(false);
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
