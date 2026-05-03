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
  it("applies a JSON Patch and persists the next state", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "patch",
      '[{"op":"replace","path":"/value","value":"patched"}]'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      patch: [{ op: "replace", path: "/value", value: "patched" }],
      state: { value: "patched", count: 1, memories: [] }
    });
    await expectState(workspace.statePath, {
      value: "patched",
      count: 1,
      memories: []
    });
  });

  it("supports patch --dry-run without writing the state file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--dry-run",
      "patch",
      '[{"op":"replace","path":"/value","value":"preview"}]'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.state.value).toBe("preview");
    await expectState(workspace.statePath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("supports patch input from --file", async () => {
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
      "--state",
      workspace.statePath,
      "patch",
      "--file",
      patchPath
    ]);

    expect(result.exitCode).toBeUndefined();
    await expectState(workspace.statePath, {
      value: "from-file",
      count: 1,
      memories: []
    });
  });

  it("rejects patch results that violate the state schema", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "patch",
      '[{"op":"replace","path":"/count","value":"bad"}]'
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
      "patch",
      '[{"op":"replace","path":"/missing","value":"bad"}]'
    ]);

    expect(result.exitCode).toBe(7);
    expect(result.json).toMatchObject({
      error: {
        code: "PATCH_FAILED"
      }
    });
    await expectState(workspace.statePath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("lists actions without reading the state file", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
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

  it("runs an action, applies its patch, and persists the next state", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "action",
      "setValue",
      '{"value":"from-action"}'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      result: {
        patch: [{ op: "replace", path: "/value", value: "from-action" }],
        state: { value: "from-action", count: 1, memories: [] }
      },
      message: "Value updated."
    });
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
      "action",
      "setValue",
      "--file",
      inputPath
    ]);

    expect(result.exitCode).toBeUndefined();
    await expectState(workspace.statePath, {
      value: "from-file",
      count: 1,
      memories: []
    });
  });

  it("supports action --dry-run without writing the state file", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--dry-run",
      "action",
      "setValue",
      '{"value":"preview-action"}'
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.result.state.value).toBe("preview-action");
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
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
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
      "action",
      "noop",
      "{}"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      result: null,
      message: "No changes."
    });
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
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
    await expectState(workspace.statePath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });

  it("rejects action patches that would violate the state schema", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
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
    await expectState(workspace.statePath, {
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
      "--state",
      workspace.statePath,
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

  it("rejects actions that directly mutate state outside JSON Patch", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "action",
      "mutateState",
      "{}"
    ]);

    expect(result.exitCode).toBe(6);
    expect(result.json).toMatchObject({
      error: {
        code: "ACTION_RUNTIME_ERROR"
      }
    });
    await expectState(workspace.statePath, {
      value: "ready",
      count: 1,
      memories: []
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-write-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const statePath = path.join(cwd, "rp.state.json");

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
      "const StateSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number(),",
      "  memories: z.array(MemorySchema).default([])",
      "});",
      "export default defineModule({",
      '  name: "write-phase",',
      "  version: 1,",
      "  state: {",
      "    version: 1,",
      "    schema: StateSchema,",
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
      "    mutateState: {",
      '      description: "Mutate state directly.",',
      "      input: z.object({}),",
      "      run({ state }) {",
      '        state.value = "mutated";',
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

  return { cwd, modulePath, statePath };
}

async function initWorkspace(workspace: { modulePath: string; statePath: string }): Promise<void> {
  const result = await runCli([
    "--module",
    workspace.modulePath,
    "--state",
    workspace.statePath,
    "init"
  ]);

  expect(result.exitCode).toBeUndefined();
}

async function expectState(statePath: string, state: unknown): Promise<void> {
  const envelope = JSON.parse(await readFile(statePath, "utf8"));

  expect(envelope.state).toEqual(state);
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
