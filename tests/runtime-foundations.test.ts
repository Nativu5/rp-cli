import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineModule } from "@rp-cli/core";
import {
  RpError,
  assertCurrentSchemaVersion,
  exportStateSchema,
  loadModule,
  parseModule,
  parseEnvelope,
  resolveRpPaths,
  toErrorShape
} from "@rp-cli/core/internal";

describe("runtime foundations", () => {
  it("rejects invalid module definitions", () => {
    expect(() => parseModule({ name: "broken" })).toThrow(RpError);

    try {
      parseModule({ name: "broken" });
    } catch (error) {
      expect(toErrorShape(error)).toMatchObject({
        error: {
          code: "MODULE_INVALID"
        }
      });
    }
  });

  it("accepts valid module definitions", () => {
    const module = defineModule({
      name: "valid",
      version: 1,
      state: {
        version: 1,
        schema: z.object({ value: z.string() }),
        defaults: () => ({ value: "ready" })
      },
      actions: {
        setValue: {
          description: "Set the value.",
          input: z.object({ value: z.string() }),
          run: ({ input }) => ({
            patch: [{ op: "replace", path: "/value", value: input.value }]
          })
        }
      },
      summaries: {
        default: ({ state }) => state
      }
    });

    expect(module.name).toBe("valid");
  });

  it("loads and validates a local TypeScript module", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rp-cli-module-"));
    const modulePath = path.join(dir, "rp.module.ts");

    await writeFile(
      modulePath,
      [
        'import { defineModule } from "@rp-cli/core";',
        'import { z } from "zod";',
        "export default defineModule({",
        '  name: "loaded",',
        "  version: 1,",
        "  state: {",
        "    version: 1,",
        "    schema: z.object({ value: z.string() }),",
        '    defaults: () => ({ value: "ready" })',
        "  }",
        "});"
      ].join("\n")
    );

    const module = await loadModule(modulePath);

    expect(module.name).toBe("loaded");
    expect(module.state.version).toBe(1);
  });

  it("rejects a local module with an invalid default export", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rp-cli-module-"));
    const modulePath = path.join(dir, "rp.module.ts");
    await writeFile(modulePath, "export default { name: 'broken' };\n");

    await expect(loadModule(modulePath)).rejects.toMatchObject({
      code: "MODULE_INVALID"
    });
  });

  it("validates state envelopes and rejects missing author state", () => {
    const envelope = parseEnvelope({
      rp: {
        module: "valid",
        moduleVersion: 1,
        schemaVersion: 1,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      state: { value: "ready" }
    });

    expect(envelope.state).toEqual({ value: "ready" });
    expect(() =>
      parseEnvelope({
        rp: {
          module: "valid",
          moduleVersion: 1,
          schemaVersion: 1,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        }
      })
    ).toThrow(RpError);
  });

  it("reports schema version mismatches with migration errors", () => {
    const module = defineModule({
      name: "valid",
      version: 1,
      state: {
        version: 2,
        schema: z.object({}),
        defaults: () => ({})
      }
    });

    expect(() =>
      assertCurrentSchemaVersion(
        {
          module: "valid",
          moduleVersion: 1,
          schemaVersion: 1,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        module
      )
    ).toThrowError(/older/);
  });

  it("uses CLI options before environment variables when resolving paths", () => {
    const previousModule = process.env.RP_MODULE;
    const previousState = process.env.RP_STATE;
    process.env.RP_MODULE = "./env.module.ts";
    process.env.RP_STATE = "./env.state.json";

    try {
      const paths = resolveRpPaths({
        cwd: "/tmp/rp-cli-test",
        modulePath: "./cli.module.ts",
        statePath: "./cli.state.json"
      });

      expect(paths.modulePath).toBe("/tmp/rp-cli-test/cli.module.ts");
      expect(paths.statePath).toBe("/tmp/rp-cli-test/cli.state.json");
      expect(paths.logPath).toBe("/tmp/rp-cli-test/cli.state.json.log.jsonl");
      expect(paths.lockPath).toBe("/tmp/rp-cli-test/cli.state.json.lock");
    } finally {
      if (previousModule === undefined) {
        delete process.env.RP_MODULE;
      } else {
        process.env.RP_MODULE = previousModule;
      }

      if (previousState === undefined) {
        delete process.env.RP_STATE;
      } else {
        process.env.RP_STATE = previousState;
      }
    }
  });

  it("formats unknown errors with the requested fallback code", () => {
    expect(toErrorShape(new Error("boom"), "WRITE_FAILED")).toEqual({
      error: {
        code: "WRITE_FAILED",
        message: "boom"
      }
    });
  });

  it("exports Zod 4 state schemas as JSON Schema", () => {
    const module = defineModule({
      name: "schema-export",
      version: 1,
      state: {
        version: 1,
        schema: z.object({
          value: z.string()
        }),
        defaults: () => ({ value: "ready" })
      }
    });

    expect(exportStateSchema(module)).toMatchObject({
      type: "object",
      properties: {
        value: {
          type: "string"
        }
      },
      required: ["value"]
    });
  });
});
