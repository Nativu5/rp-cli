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

describe("action output contract", () => {
  it("prints action lists as readable text by default", async () => {
    const workspace = await createWorkspace();

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "action", "--list"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe(
      ["setValue: Set the value.", "increment: Increment count.", "breakSchema: Break schema."].join("\n") + "\n"
    );
  });

  it("keeps action lists as JSON when --output=json is used", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--output",
      "json",
      "action",
      "--list"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual([
      { name: "setValue", description: "Set the value." },
      { name: "increment", description: "Increment count." },
      { name: "breakSchema", description: "Break schema." }
    ]);
  });

  it("prints view lists as readable text by default and omits missing descriptions", async () => {
    const workspace = await createWorkspace();

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "view", "--list"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe("summary\n");
  });

  it("keeps view lists as JSON when --output=json is used", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--output",
      "json",
      "view",
      "--list"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual([{ name: "summary" }]);
  });

  it("lets actions mutate model directly and prints only string result by default", async () => {
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
    expect(result.stdout).toBe("Value updated.\n");
    await expectModel(workspace.modelPath, {
      value: "from-action",
      count: 1
    });
  });

  it("wraps action result in a JSON envelope when --output=json is used", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--output",
      "json",
      "action",
      "setValue",
      '{"value":"json-mode"}'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual({ result: "Value updated." });
    await expectModel(workspace.modelPath, {
      value: "json-mode",
      count: 1
    });
  });

  it("prints object results without including the full model by default", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "increment",
      "{}"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual({ count: 2 });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 2
    });
  });

  it("wraps view result in a JSON envelope when --output=json is used", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--output",
      "json",
      "view",
      "summary"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout)).toEqual({
      result: {
        value: "ready",
        count: 1
      }
    });
  });

  it("rejects direct mutations that violate the model schema without writing them", async () => {
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
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: {
        code: "MODEL_VALIDATION_ERROR"
      }
    });
    await expectModel(workspace.modelPath, {
      value: "ready",
      count: 1
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-action-output-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const modelPath = path.join(cwd, "rp.model.json");

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
      '  name: "action-output-contract",',
      "  version: 1,",
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
      "        return {",
      '          reason: "value changed by action",',
      '          result: "Value updated."',
      "        };",
      "      }",
      "    },",
      "    increment: {",
      '      description: "Increment count.",',
      "      input: z.object({}),",
      "      run({ model }) {",
      "        model.count += 1;",
      "        return { result: { count: model.count } };",
      "      }",
      "    },",
      "    breakSchema: {",
      '      description: "Break schema.",',
      "      input: z.object({}),",
      "      run({ model }) {",
      "        model.count = 'bad';",
      '        return { result: "broken" };',
      "      }",
      "    }",
      "  },",
      "  views: {",
      "    summary({ model }) {",
      "      return { result: { value: model.value, count: model.count } };",
      "    }",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
}

async function initWorkspace(workspace: { modulePath: string; modelPath: string }): Promise<void> {
  const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

  expect(result.exitCode).toBeUndefined();
}

async function expectModel(modelPath: string, model: unknown): Promise<void> {
  const envelope = JSON.parse(await readFile(modelPath, "utf8"));

  expect(envelope.model).toEqual(model);
}

async function runCli(args: string[]): Promise<{
  stdout: string;
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

  return {
    stdout: writes.join(""),
    exitCode: process.exitCode
  };
}
