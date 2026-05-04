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

describe("migration CLI", () => {
  it("migrates an old model file, persists the envelope, and appends a log entry", async () => {
    const workspace = await createWorkspace();
    await writeOldModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "migrate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      model: {
        value: "old",
        count: 1
      }
    });
    expect(result.json.model.migratedAt).toEqual(expect.any(String));

    const envelope = JSON.parse(await readFile(workspace.modelPath, "utf8"));
    expect(envelope).toMatchObject({
      rp: {
        module: "migration-phase",
        moduleVersion: 9,
        schemaVersion: 2,
        createdAt: "2026-05-03T12:00:00.000Z"
      },
      model: result.json.model
    });
    expect(envelope.rp.updatedAt).not.toBe("2026-05-03T12:00:00.000Z");

    const logLines = (await readFile(`${workspace.modelPath}.log.jsonl`, "utf8")).trim().split("\n");
    expect(logLines).toHaveLength(1);
    expect(JSON.parse(logLines[0])).toMatchObject({
      type: "migrate",
      fromVersion: 1,
      toVersion: 2,
      modelHashBefore: expect.stringMatching(/^sha256:/),
      modelHashAfter: expect.stringMatching(/^sha256:/)
    });
  });

  it("previews migration with --dry-run without writing model or log files", async () => {
    const workspace = await createWorkspace();
    await writeOldModel(workspace.modelPath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "--dry-run",
      "migrate"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      model: {
        value: "old",
        count: 1
      }
    });

    const envelope = JSON.parse(await readFile(workspace.modelPath, "utf8"));
    expect(envelope.rp.schemaVersion).toBe(1);
    await expect(readFile(`${workspace.modelPath}.log.jsonl`, "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("returns a no-op migration result when the model file is current", async () => {
    const workspace = await createWorkspace();
    await writeCurrentModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "migrate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      fromVersion: 2,
      toVersion: 2,
      model: {
        value: "current",
        count: 2,
        migratedAt: "2026-05-03T12:00:00.000Z"
      }
    });
    await expect(readFile(`${workspace.modelPath}.log.jsonl`, "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects model files from a newer schema version", async () => {
    const workspace = await createWorkspace();
    await writeModelEnvelope(workspace.modelPath, 3, {
      value: "future",
      count: 3,
      migratedAt: "2026-05-03T12:00:00.000Z"
    });

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "migrate"]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "MIGRATION_FAILED",
        details: {
          fromVersion: 3,
          toVersion: 2
        }
      }
    });
  });

  it("requires a migrate function for old model files", async () => {
    const workspace = await createWorkspace({ includeMigrate: false });
    await writeOldModel(workspace.modelPath);

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "migrate"]);

    expect(result.exitCode).toBe(5);
    expect(result.json).toMatchObject({
      error: {
        code: "MIGRATION_REQUIRED",
        details: {
          fromVersion: 1,
          toVersion: 2
        }
      }
    });
  });

  it("rejects migrations for model files owned by a different module", async () => {
    const workspace = await createWorkspace();
    await writeModelEnvelope(workspace.modelPath, 1, { value: "old" }, "other-module");

    const result = await runCli(["--module", workspace.modulePath, "--model", workspace.modelPath, "migrate"]);

    expect(result.exitCode).toBe(3);
    expect(result.json).toMatchObject({
      error: {
        code: "MODULE_MODEL_MISMATCH",
        details: {
          modelModule: "other-module",
          module: "migration-phase"
        }
      }
    });
  });
});

async function createWorkspace(options: { includeMigrate?: boolean } = {}): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-migration-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const modelPath = path.join(cwd, "rp.model.json");
  const includeMigrate = options.includeMigrate ?? true;

  await writeFile(
    modulePath,
    [
      'import { defineModule } from "@rp-cli/core";',
      'import { z } from "zod";',
      "const OldModelSchema = z.object({",
      "  value: z.string()",
      "});",
      "const ModelSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number(),",
      "  migratedAt: z.string()",
      "});",
      "export default defineModule({",
      '  name: "migration-phase",',
      "  version: 9,",
      "  model: {",
      "    version: 2,",
      "    schema: ModelSchema,",
      '    defaults: () => ({ value: "current", count: 2, migratedAt: "2026-05-03T12:00:00.000Z" })' +
        (includeMigrate
          ? ",\n    migrate({ model, fromVersion, toVersion, ctx }) {\n      const old = OldModelSchema.parse(model);\n      return {\n        value: old.value,\n        count: toVersion - fromVersion,\n        migratedAt: ctx.now()\n      };\n    }"
          : ""),
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
}

async function writeOldModel(modelPath: string): Promise<void> {
  await writeModelEnvelope(modelPath, 1, { value: "old" });
}

async function writeCurrentModel(modelPath: string): Promise<void> {
  await writeModelEnvelope(modelPath, 2, {
    value: "current",
    count: 2,
    migratedAt: "2026-05-03T12:00:00.000Z"
  });
}

async function writeModelEnvelope(
  modelPath: string,
  schemaVersion: number,
  model: unknown,
  moduleName = "migration-phase"
): Promise<void> {
  await writeFile(
    modelPath,
    JSON.stringify({
      rp: {
        module: moduleName,
        moduleVersion: 8,
        schemaVersion,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      model
    })
  );
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
