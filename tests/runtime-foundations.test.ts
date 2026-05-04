import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineModule } from "@rp-cli/core";
import {
  RpError,
  assertCurrentSchemaVersion,
  exportModelSchema,
  loadModule,
  parseModule,
  parseEnvelope,
  resolveRpPaths,
  toErrorShape,
  validateModelFile
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
      model: {
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
      views: {
        default: ({ model }) => model
      }
    });

    expect(module.name).toBe("valid");
  });

  it("rejects old state and summaries module fields", () => {
    expect(() =>
      parseModule({
        name: "old-fields",
        version: 1,
        state: {
          version: 1,
          schema: z.object({ value: z.string() }),
          defaults: () => ({ value: "ready" })
        },
        summaries: {
          default: () => ({})
        }
      })
    ).toThrow(RpError);
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
        "  model: {",
        "    version: 1,",
        "    schema: z.object({ value: z.string() }),",
        '    defaults: () => ({ value: "ready" })',
        "  }",
        "});"
      ].join("\n")
    );

    const module = await loadModule(modulePath);

    expect(module.name).toBe("loaded");
    expect(module.model.version).toBe(1);
  });

  it("rejects a local module with an invalid default export", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rp-cli-module-"));
    const modulePath = path.join(dir, "rp.module.ts");
    await writeFile(modulePath, "export default { name: 'broken' };\n");

    await expect(loadModule(modulePath)).rejects.toMatchObject({
      code: "MODULE_INVALID"
    });
  });

  it("reports unsupported module file extensions before importing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rp-cli-module-"));
    const modulePath = path.join(dir, "rp.module.json");
    await writeFile(modulePath, "{}\n");

    await expect(loadModule(modulePath)).rejects.toMatchObject({
      code: "MODULE_INVALID",
      details: {
        supportedExtensions: [".ts", ".mts", ".js", ".mjs", ".cjs"]
      }
    });
  });

  it("validates model envelopes and rejects missing author model", () => {
    const envelope = parseEnvelope({
      rp: {
        module: "valid",
        moduleVersion: 1,
        schemaVersion: 1,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      model: { value: "ready" }
    });

    expect(envelope.model).toEqual({ value: "ready" });
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
      model: {
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

  it("rejects model files owned by a different module", () => {
    const module = defineModule({
      name: "current-module",
      version: 1,
      model: {
        version: 1,
        schema: z.object({ value: z.string() }),
        defaults: () => ({ value: "ready" })
      }
    });

    expect(() =>
      validateModelFile(module, {
        rp: {
          module: "other-module",
          moduleVersion: 1,
          schemaVersion: 1,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        model: {
          value: "ready"
        }
      })
    ).toThrowError(/belongs to a different module/);
  });

  it("uses CLI options before environment variables when resolving paths", () => {
    const previousModule = process.env.RP_MODULE;
    const previousModel = process.env.RP_MODEL;
    process.env.RP_MODULE = "./env.module.ts";
    process.env.RP_MODEL = "./env.model.json";

    try {
      const paths = resolveRpPaths({
        cwd: "/tmp/rp-cli-test",
        modulePath: "./cli.module.ts",
        modelPath: "./cli.model.json"
      });

      expect(paths.modulePath).toBe("/tmp/rp-cli-test/cli.module.ts");
      expect(paths.modelPath).toBe("/tmp/rp-cli-test/cli.model.json");
      expect(paths.logPath).toBe("/tmp/rp-cli-test/cli.model.json.log.jsonl");
      expect(paths.lockPath).toBe("/tmp/rp-cli-test/cli.model.json.lock");
    } finally {
      if (previousModule === undefined) {
        delete process.env.RP_MODULE;
      } else {
        process.env.RP_MODULE = previousModule;
      }

      if (previousModel === undefined) {
        delete process.env.RP_MODEL;
      } else {
        process.env.RP_MODEL = previousModel;
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

  it("exports Zod 4 model schemas as JSON Schema", () => {
    const module = defineModule({
      name: "schema-export",
      version: 1,
      model: {
        version: 1,
        schema: z.object({
          value: z.string()
        }),
        defaults: () => ({ value: "ready" })
      }
    });

    expect(exportModelSchema(module)).toMatchObject({
      type: "object",
      properties: {
        value: {
          type: "string"
        }
      },
      required: ["value"]
    });
  });

  it("does not use deprecated top-level ZodIssue imports", async () => {
    const source = await readFile(
      new URL("../packages/core/src/validation.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toMatch(/import\s+type\s+\{[^}]*\bZodIssue\b[^}]*\}\s+from\s+["']zod["']/);
  });
});
