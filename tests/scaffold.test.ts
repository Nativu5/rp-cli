import { describe, expect, it } from "vitest";
import { defineModule, resolveRpPaths } from "@rp-cli/core";
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
      "actions",
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
});
