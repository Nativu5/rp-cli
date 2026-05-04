import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../packages/cli/src/cli.js";

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("model lifecycle CLI", () => {
  it("initializes a model file from module defaults", async () => {
    const workspace = await createWorkspace();
    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      rp: {
        module: "phase-three",
        moduleVersion: 7,
        schemaVersion: 3
      },
      model: {
        value: "ready",
        count: 1
      }
    });
    expect(result.json.rp.createdAt).toEqual(result.json.rp.updatedAt);

    const written = JSON.parse(await readFile(workspace.modelPath, "utf8"));
    expect(written).toEqual(result.json);
  });

  it("refuses to initialize over an existing model file without --force", async () => {
    const workspace = await createWorkspace();
    await writeFile(workspace.modelPath, JSON.stringify({ existing: true }));

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    expect(result.exitCode).toBe(8);
    expect(result.json).toMatchObject({
      error: {
        code: "WRITE_FAILED"
      }
    });
    expect(JSON.parse(await readFile(workspace.modelPath, "utf8"))).toEqual({
      existing: true
    });
  });

  it("overwrites an existing model file with init --force", async () => {
    const workspace = await createWorkspace();
    await writeFile(workspace.modelPath, JSON.stringify({ existing: true }));

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init", "--force"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.model).toEqual({ value: "ready", count: 1 });
  });

  it("uses environment paths when CLI paths are omitted", async () => {
    const workspace = await createWorkspace();
    const previousModule = process.env.RP_MODULE;
    const previousModel = process.env.RP_MODEL;
    process.env.RP_MODULE = workspace.modulePath;
    process.env.RP_MODEL = workspace.modelPath;

    try {
      const result = await runCli(["init"]);

      expect(result.exitCode).toBeUndefined();
      expect(result.json.rp.module).toBe("phase-three");
      expect(JSON.parse(await readFile(workspace.modelPath, "utf8"))).toEqual(result.json);
    } finally {
      restoreEnv("RP_MODULE", previousModule);
      restoreEnv("RP_MODEL", previousModel);
    }
  });

  it("uses CLI paths before environment paths", async () => {
    const workspace = await createWorkspace();
    const envWorkspace = await createWorkspace();
    const previousModule = process.env.RP_MODULE;
    const previousModel = process.env.RP_MODEL;
    process.env.RP_MODULE = envWorkspace.modulePath;
    process.env.RP_MODEL = envWorkspace.modelPath;

    try {
      const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

      expect(result.exitCode).toBeUndefined();
      expect(JSON.parse(await readFile(workspace.modelPath, "utf8"))).toEqual(result.json);
      await expect(readFile(envWorkspace.modelPath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      restoreEnv("RP_MODULE", previousModule);
      restoreEnv("RP_MODEL", previousModel);
    }
  });

  it("validates a current model file", async () => {
    const workspace = await createWorkspace();
    await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "validate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      valid: true,
      module: "phase-three",
      moduleVersion: 7,
      schemaVersion: 3
    });
  });

  it("returns validation errors for schema-invalid model", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      workspace.modelPath,
      JSON.stringify({
        rp: {
          module: "phase-three",
          moduleVersion: 7,
          schemaVersion: 3,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        model: {
          value: 123,
          count: 1
        }
      })
    );

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "validate"]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
  });

  it("outputs author model and raw envelope", async () => {
    const workspace = await createWorkspace();
    await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    const modelResult = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "model"]);
    const rawResult = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "model",
      "--raw"
    ]);

    expect(modelResult.json).toEqual({ value: "ready", count: 1 });
    expect(rawResult.json).toMatchObject({
      rp: {
        module: "phase-three",
        schemaVersion: 3
      },
      model: {
        value: "ready",
        count: 1
      }
    });
  });

  it("returns MODEL_LOCKED when the model lock exists", async () => {
    const workspace = await createWorkspace();
    await writeFile(`${workspace.modelPath}.lock`, "locked");

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    expect(result.exitCode).toBe(8);
    expect(result.json).toMatchObject({
      error: {
        code: "MODEL_LOCKED"
      }
    });
  });

  it("recovers stale model locks", async () => {
    const workspace = await createWorkspace();
    await mkdir(`${workspace.modelPath}.lock`);
    const staleTime = new Date(Date.now() - 60_000);
    await utimes(`${workspace.modelPath}.lock`, staleTime, staleTime);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json.model).toEqual({ value: "ready", count: 1 });
  });

  it("waits briefly for active model locks to release", async () => {
    const workspace = await createWorkspace();
    await mkdir(`${workspace.modelPath}.lock`);
    const releaseLock = setTimeout(() => {
      void rm(`${workspace.modelPath}.lock`, { recursive: true, force: true });
    }, 50);

    try {
      const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "init"]);

      expect(result.exitCode).toBeUndefined();
      expect(result.json.model).toEqual({ value: "ready", count: 1 });
    } finally {
      clearTimeout(releaseLock);
      await rm(`${workspace.modelPath}.lock`, { recursive: true, force: true });
    }
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-model-"));
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
      '  name: "phase-three",',
      "  version: 7,",
      "  model: {",
      "    version: 3,",
      "    schema: ModelSchema,",
      '    defaults: () => ({ value: "ready", count: 1 })',
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
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
