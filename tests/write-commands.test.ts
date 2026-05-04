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

describe("write commands", () => {
  it("applies a raw update and persists the next model", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "update",
      '[{"op":"replace","path":"/value","value":"patched"}]'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      patch: [{ op: "replace", path: "/value", value: "patched" }],
      model: { value: "patched", count: 1, memories: [] }
    });
    await expectModel(workspace.modelPath, {
      value: "patched",
      count: 1,
      memories: []
    });
  });

  it("supports update --dry-run without writing the model file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--dry-run",
      "update",
      '[{"op":"replace","path":"/value","value":"preview"}]'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.model.value).toBe("preview");
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("supports update input from --file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);
    const patchPath = path.join(workspace.cwd, "patch.json");
    await writeFile(
      patchPath,
      JSON.stringify([{ op: "replace", path: "/value", value: "from-file" }])
    );

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "update",
      "--file",
      patchPath
    ]);

    expect(result.exitCode).toBeUndefined();
    await expectModel(workspace.modelPath, {
      value: "from-file",
      count: 1,
      memories: []
    });
  });

  it("rejects update results that violate the model schema", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "update",
      '[{"op":"replace","path":"/count","value":"bad"}]'
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("reports apply failures for valid patch syntax that cannot be applied", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "update",
      '[{"op":"replace","path":"/missing","value":"bad"}]'
    ]);

    expect(result.exitCode).toBe(7);
    expect(result.json).toMatchObject({
      error: {
        code: "PATCH_FAILED"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("lists actions without reading the model file", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "--list"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual(
      expect.arrayContaining([
        { name: "setValue", description: "Set the value." },
        { name: "remember", description: "Remember text." }
      ])
    );
  });

  it("runs an action, applies its patch, and persists the next model", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "setValue",
      '{"value":"from-action"}'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      result: {
        patch: [{ op: "replace", path: "/value", value: "from-action" }],
        model: { value: "from-action", count: 1, memories: [] }
      },
      message: "Value updated."
    });
    await expectModel(workspace.modelPath, {
      value: "from-action",
      count: 1,
      memories: []
    });
  });

  it("supports action input from --file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);
    const inputPath = path.join(workspace.cwd, "input.json");
    await writeFile(inputPath, JSON.stringify({ value: "from-file" }));

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "setValue",
      "--file",
      inputPath
    ]);

    expect(result.exitCode).toBeUndefined();
    await expectModel(workspace.modelPath, {
      value: "from-file",
      count: 1,
      memories: []
    });
  });

  it("supports action --dry-run without writing the model file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--dry-run",
      "action",
      "setValue",
      '{"value":"preview-action"}'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.result.model.value).toBe("preview-action");
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("rejects invalid action input without writing", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "setValue",
      '{"value":123}'
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_INPUT_INVALID"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("returns null result for actions with no patch operations", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "noop",
      "{}"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      result: null,
      message: "No changes."
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("rejects invalid action return values", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "badReturn",
      "{}"
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_RETURN_INVALID"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("rejects action patches that would violate the model schema", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "breakSchema",
      "{}"
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("reports action runtime errors", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "explode",
      "{}"
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_RUNTIME_ERROR"
      }
    });
  });

  it("rejects actions that directly mutate model outside JSON Patch", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "mutateModel",
      "{}"
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_RUNTIME_ERROR"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-write-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const modelPath = path.join(cwd, "rp.model.json");

  await writeFile(
    modulePath,
    [
      'import { defineModule } from "@rp-cli/core";',
      'import { z } from "zod";',
      "const MemorySchema = z.object({",
      "  id: z.string(),",
      "  text: z.string(),",
      "  createdAt: z.string()",
      "});",
      "const ModelSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number(),",
      "  memories: z.array(MemorySchema).default([])",
      "});",
      "export default defineModule({",
      '  name: "write-phase",',
      "  version: 1,",
      "  model: {",
      "    version: 1,",
      "    schema: ModelSchema,",
      '    defaults: () => ({ value: "ready", count: 1, memories: [] })',
      "  },",
      "  actions: {",
      "    setValue: {",
      '      description: "Set the value.",',
      "      input: z.object({ value: z.string() }),",
      "      run({ input }) {",
      "        return {",
      '          patch: [{ op: "replace", path: "/value", value: input.value }],',
      '          message: "Value updated."',
      "        };",
      "      }",
      "    },",
      "    remember: {",
      '      description: "Remember text.",',
      "      input: z.object({ text: z.string() }),",
      "      run({ input, ctx }) {",
      "        return {",
      '          patch: [{ op: "add", path: "/memories/-", value: { id: ctx.id("mem"), text: input.text, createdAt: ctx.now() } }]',
      "        };",
      "      }",
      "    },",
      "    noop: {",
      '      description: "No operation.",',
      "      input: z.object({}),",
      '      run: () => ({ patch: [], message: "No changes." })',
      "    },",
      "    badReturn: {",
      '      description: "Return invalid data.",',
      "      input: z.object({}),",
      '      run: () => ({ patch: "bad" })',
      "    },",
      "    breakSchema: {",
      '      description: "Return schema-invalid patch.",',
      "      input: z.object({}),",
      '      run: () => ({ patch: [{ op: "replace", path: "/count", value: "bad" }] })',
      "    },",
      "    mutateModel: {",
      '      description: "Mutate model directly.",',
      "      input: z.object({}),",
      "      run({ model }) {",
      '        model.value = "mutated";',
      "        return { patch: [] };",
      "      }",
      "    },",
      "    explode: {",
      '      description: "Throw an error.",',
      "      input: z.object({}),",
      '      run: () => { throw new Error("boom"); }',
      "    }",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
}

async function initWorkspace(workspace: { modulePath: string; modelPath: string }): Promise<void> {
  const result = await runCli([
    "--module",
    workspace.modulePath,
    "--model",
    workspace.modelPath,
    "init"
  ]);

  expect(result.exitCode).toBeUndefined();
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

  return {
    stdout,
    json: JSON.parse(stdout),
    exitCode: process.exitCode
  };
}
