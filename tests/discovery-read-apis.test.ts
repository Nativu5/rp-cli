import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../packages/cli/src/cli.js";

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("discovery and read APIs", () => {
  it("lists views without reading the model file", async () => {
    const workspace = await createWorkspace();

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "--list"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual([
      { name: "default", description: "Full view." },
      { name: "brief" },
      { name: "debug", description: "Debug view." },
      { name: "explode", description: "Throw an error." },
      { name: "mutate", description: "Mutate model directly." },
      { name: "breakSchema", description: "Mutate model into an invalid shape." }
    ]);
  });

  it("runs the default view against the validated current model", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);
    const before = await readFile(workspace.modelPath, "utf8");

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "default"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      kind: "default",
      value: "ready",
      count: 1,
      module: "discovery-phase"
    });
    expect(await readFile(workspace.modelPath, "utf8")).toBe(before);
  });

  it("runs a named view", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "debug"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      raw: {
        value: "ready",
        count: 1
      },
      schemaVersion: 1
    });
  });

  it("requires a view name", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view"]);

    expect(result.exitCode).toBe(1);
    expect(result.json).toMatchObject({
      error: {
        code: "VIEW_NOT_FOUND"
      }
    });
  });

  it("falls back to the brief view when no default view exists", async () => {
    const workspace = await createWorkspace({ includeDefaultView: false });
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "brief"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      kind: "brief",
      value: "ready"
    });
  });

  it("falls back to the first view when default and brief are missing", async () => {
    const workspace = await createWorkspace({
      includeDefaultView: false,
      includeBriefView: false
    });
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "debug"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      raw: {
        value: "ready",
        count: 1
      },
      schemaVersion: 1
    });
  });

  it("reports view runtime errors", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "explode"]);

    expect(result.exitCode).toBe(1);
    expect(result.json).toMatchObject({
      error: {
        code: "VIEW_RUNTIME_ERROR"
      }
    });
  });

  it("persists model mutations made by a successful view", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "mutate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      value: "mutated",
      count: 1
    });
    await expectModel(workspace.modelPath, {
      value: "mutated",
      count: 1
    });
  });

  it("rejects view mutations that violate the model schema without writing them", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "view",
      "breakSchema"
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "MODEL_VALIDATION_ERROR"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1
    });
  });

  it("outputs the model JSON Schema from model --schema", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "model",
      "--schema"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      type: "object",
      properties: {
        value: { type: "string" },
        count: { type: "number" }
      },
      required: ["value", "count"]
    });
  });

  it("outputs an action input JSON Schema from action --schema", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "setValue",
      "--schema"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      type: "object",
      properties: {
        value: { type: "string" }
      },
      required: ["value"]
    });
  });

  it("reports ACTION_NOT_FOUND for missing action schemas", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "missing",
      "--schema"
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_NOT_FOUND"
      }
    });
  });
});

async function createWorkspace(
  options: {
    includeDefaultView?: boolean;
    includeBriefView?: boolean;
  } = {}
): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-discovery-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const modelPath = path.join(cwd, "rp.model.json");
  const includeDefaultView = options.includeDefaultView ?? true;
  const includeBriefView = options.includeBriefView ?? true;

  await writeFile(
    modulePath,
    [
      'import { defineModule } from "@rp-cli/core";',
      'import { z } from "zod";',
      "const ModelSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number()",
      "});",
      "export default defineModule({",
      '  name: "discovery-phase",',
      "  version: 4,",
      "  model: {",
      "    version: 1,",
      "    schema: ModelSchema,",
      '    defaults: () => ({ value: "ready", count: 1 })',
      "  },",
      "  actions: {",
      "    setValue: {",
      '      description: "Set the value.",',
      "      input: z.object({ value: z.string() }),",
      "      run({ model, input }) {",
      "        model.value = input.value;",
      "        return { result: model.value };",
      "      }",
      "    }",
      "  },",
      "  views: {",
      ...(includeDefaultView
        ? [
            "    default: {",
            '      description: "Full view.",',
            "      run: ({ model, meta }) => ({ result: {",
            '        kind: "default",',
            "        value: model.value,",
            "        count: model.count,",
            "        module: meta.module",
            "      } })",
            "    },"
          ]
        : []),
      ...(includeBriefView ? ["    brief: ({ model }) => ({ result: { kind: 'brief', value: model.value } }),"] : []),
      "    debug: {",
      '      description: "Debug view.",',
      "      run: ({ model, meta }) => ({ result: { raw: model, schemaVersion: meta.schemaVersion } })",
      "    },",
      "    explode: {",
      '      description: "Throw an error.",',
      "      run: () => { throw new Error('boom'); }",
      "    },",
      "    mutate: {",
      '      description: "Mutate model directly.",',
      "      run: ({ model }) => {",
      "        model.value = 'mutated';",
      "        return { result: model };",
      "      }",
      "    },",
      "    breakSchema: {",
      '      description: "Mutate model into an invalid shape.",',
      "      run: ({ model }) => {",
      "        model.count = 'bad';",
      "        return { result: model };",
      "      }",
      "    }",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
}

async function writeCurrentModel(modelPath: string): Promise<void> {
  await writeFile(
    modelPath,
    JSON.stringify({
      rp: {
        module: "discovery-phase",
        moduleVersion: 4,
        schemaVersion: 1,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      model: {
        value: "ready",
        count: 1
      }
    })
  );
}

async function expectModel(modelPath: string, model: unknown): Promise<void> {
  const envelope = JSON.parse(await readFile(modelPath, "utf8"));

  expect(envelope.model).toEqual(model);
}

async function runCli(args: string[]): Promise<{
  stdout: string;
  json: any;
  exitCode: string | number | undefined;
}> {
  const writes: string[] = [];
  process.exitCode = undefined;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    writes.push(String(chunk));
    return true;
  });

  const program = createProgram();
  program.exitOverride();
  await program.parseAsync(args, { from: "user" });

  const stdout = writes.join("");
  let json: any;

  try {
    json = stdout.length === 0 ? undefined : JSON.parse(stdout);
  } catch {
    json = undefined;
  }

  return {
    stdout,
    json,
    exitCode: process.exitCode
  };
}
