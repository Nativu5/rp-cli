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

describe("operation logging", () => {
  it("appends patch logs and reads them with rp log", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    const patchResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--reason",
      "manual patch",
      "patch",
      '[{"op":"replace","path":"/value","value":"patched"}]'
    ]);

    expect(patchResult.exitCode).toBeUndefined();

    const logResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "log"
    ]);

    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toHaveLength(1);
    expect(logResult.json[0]).toMatchObject({
      type: "patch",
      reason: "manual patch",
      patch: [{ op: "replace", path: "/value", value: "patched" }],
      stateHashBefore: expect.stringMatching(/^sha256:/),
      stateHashAfter: expect.stringMatching(/^sha256:/)
    });
    expect(logResult.json[0].id).toEqual(expect.stringMatching(/^log_/));
    expect(logResult.json[0].time).toEqual(expect.any(String));
  });

  it("appends action logs with CLI reason, action reason, message, input, and patch", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--reason",
      "semantic update",
      "action",
      "setValue",
      '{"value":"from-action"}'
    ]);

    const logResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "log"
    ]);

    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toHaveLength(1);
    expect(logResult.json[0]).toMatchObject({
      type: "action",
      name: "setValue",
      reason: "semantic update",
      actionReason: "value changed by action",
      message: "Value updated.",
      input: { value: "from-action" },
      patch: [{ op: "replace", path: "/value", value: "from-action" }],
      stateHashBefore: expect.stringMatching(/^sha256:/),
      stateHashAfter: expect.stringMatching(/^sha256:/)
    });
  });

  it("limits rp log output to the most recent entries", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "patch",
      '[{"op":"replace","path":"/value","value":"first"}]'
    ]);
    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "action",
      "setValue",
      '{"value":"second"}'
    ]);

    const logResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "log",
      "--limit",
      "1"
    ]);

    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toHaveLength(1);
    expect(logResult.json[0]).toMatchObject({
      type: "action",
      name: "setValue"
    });
  });

  it("does not append logs for dry-run writes", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);

    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--dry-run",
      "patch",
      '[{"op":"replace","path":"/value","value":"preview"}]'
    ]);

    const logResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "log"
    ]);

    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toEqual([]);
  });

  it("returns LOG_WRITE_FAILED without rolling back the state write", async () => {
    const workspace = await createWorkspace();
    await initWorkspace(workspace);
    await mkdir(`${workspace.statePath}.log.jsonl`);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "patch",
      '[{"op":"replace","path":"/value","value":"written-before-log-failure"}]'
    ]);

    expect(result.exitCode).toBe(8);
    expect(result.json).toMatchObject({
      error: {
        code: "LOG_WRITE_FAILED"
      }
    });
    await expectState(workspace.statePath, {
      value: "written-before-log-failure",
      count: 1
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-logging-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const statePath = path.join(cwd, "rp.state.json");

  await writeFile(
    modulePath,
    [
      'import { defineModule } from "@rp-cli/core";',
      'import { z } from "zod";',
      "const StateSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number()",
      "});",
      "export default defineModule({",
      '  name: "logging-phase",',
      "  version: 1,",
      "  state: {",
      "    version: 1,",
      "    schema: StateSchema,",
      '    defaults: () => ({ value: "ready", count: 1 })',
      "  },",
      "  actions: {",
      "    setValue: {",
      '      description: "Set the value.",',
      "      input: z.object({ value: z.string() }),",
      "      run({ input }) {",
      "        return {",
      "          patch: [{ op: 'replace', path: '/value', value: input.value }],",
      "          reason: 'value changed by action',",
      "          message: 'Value updated.'",
      "        };",
      "      }",
      "    }",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, statePath };
}

async function initWorkspace(workspace: {
  modulePath: string;
  statePath: string;
}): Promise<void> {
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
