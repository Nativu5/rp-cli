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

describe("state lifecycle CLI", () => {
  it("initializes a state file from module defaults", async () => {
    const workspace = await createWorkspace();
    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      rp: {
        module: "phase-three",
        moduleVersion: 7,
        schemaVersion: 3
      },
      state: {
        value: "ready",
        count: 1
      }
    });
    expect(result.json.rp.createdAt).toEqual(result.json.rp.updatedAt);

    const written = JSON.parse(await readFile(workspace.statePath, "utf8"));
    expect(written).toEqual(result.json);
  });

  it("refuses to initialize over an existing state file without --force", async () => {
    const workspace = await createWorkspace();
    await writeFile(workspace.statePath, JSON.stringify({ existing: true }));

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init"
    ]);

    expect(result.exitCode).toBe(8);
    expect(result.json).toMatchObject({
      error: {
        code: "WRITE_FAILED"
      }
    });
    expect(JSON.parse(await readFile(workspace.statePath, "utf8"))).toEqual({
      existing: true
    });
  });

  it("overwrites an existing state file with init --force", async () => {
    const workspace = await createWorkspace();
    await writeFile(workspace.statePath, JSON.stringify({ existing: true }));

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init",
      "--force"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.state).toEqual({ value: "ready", count: 1 });
  });

  it("validates a current state file", async () => {
    const workspace = await createWorkspace();
    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init"
    ]);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "validate"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      valid: true,
      module: "phase-three",
      moduleVersion: 7,
      schemaVersion: 3
    });
  });

  it("returns validation errors for schema-invalid state", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      workspace.statePath,
      JSON.stringify({
        rp: {
          module: "phase-three",
          moduleVersion: 7,
          schemaVersion: 3,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        state: {
          value: 123,
          count: 1
        }
      })
    );

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "validate"
    ]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
  });

  it("outputs author state and raw envelope", async () => {
    const workspace = await createWorkspace();
    await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init"
    ]);

    const stateResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "state"
    ]);
    const rawResult = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "state",
      "--raw"
    ]);

    expect(stateResult.json).toEqual({ value: "ready", count: 1 });
    expect(rawResult.json).toMatchObject({
      rp: {
        module: "phase-three",
        schemaVersion: 3
      },
      state: {
        value: "ready",
        count: 1
      }
    });
  });

  it("returns STATE_LOCKED when the state lock exists", async () => {
    const workspace = await createWorkspace();
    await writeFile(`${workspace.statePath}.lock`, "locked");

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "init"
    ]);

    expect(result.exitCode).toBe(8);
    expect(result.json).toMatchObject({
      error: {
        code: "STATE_LOCKED"
      }
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-state-"));
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
      '  name: "phase-three",',
      "  version: 7,",
      "  state: {",
      "    version: 3,",
      "    schema: StateSchema,",
      '    defaults: () => ({ value: "ready", count: 1 })',
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, statePath };
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
