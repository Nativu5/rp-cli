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
  it("migrates an old state file, persists the envelope, and appends a log entry", async () => {
    const workspace = await createWorkspace();
    await writeOldState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "migrate"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      state: {
        value: "old",
        count: 1
      }
    });
    expect(result.json.state.migratedAt).toEqual(expect.any(String));

    const envelope = JSON.parse(await readFile(workspace.statePath, "utf8"));
    expect(envelope).toMatchObject({
      rp: {
        module: "migration-phase",
        moduleVersion: 9,
        schemaVersion: 2,
        createdAt: "2026-05-03T12:00:00.000Z"
      },
      state: result.json.state
    });
    expect(envelope.rp.updatedAt).not.toBe("2026-05-03T12:00:00.000Z");

    const logLines = (await readFile(`${workspace.statePath}.log.jsonl`, "utf8"))
      .trim()
      .split("\n");
    expect(logLines).toHaveLength(1);
    expect(JSON.parse(logLines[0])).toMatchObject({
      type: "migrate",
      fromVersion: 1,
      toVersion: 2,
      stateHashBefore: expect.stringMatching(/^sha256:/),
      stateHashAfter: expect.stringMatching(/^sha256:/)
    });
  });

  it("previews migration with --dry-run without writing state or log files", async () => {
    const workspace = await createWorkspace();
    await writeOldState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "--dry-run",
      "migrate"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      state: {
        value: "old",
        count: 1
      }
    });

    const envelope = JSON.parse(await readFile(workspace.statePath, "utf8"));
    expect(envelope.rp.schemaVersion).toBe(1);
    await expect(readFile(`${workspace.statePath}.log.jsonl`, "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("returns a no-op migration result when the state file is current", async () => {
    const workspace = await createWorkspace();
    await writeCurrentState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "migrate"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      fromVersion: 2,
      toVersion: 2,
      state: {
        value: "current",
        count: 2,
        migratedAt: "2026-05-03T12:00:00.000Z"
      }
    });
    await expect(readFile(`${workspace.statePath}.log.jsonl`, "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects state files from a newer schema version", async () => {
    const workspace = await createWorkspace();
    await writeStateEnvelope(workspace.statePath, 3, {
      value: "future",
      count: 3,
      migratedAt: "2026-05-03T12:00:00.000Z"
    });

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "migrate"
    ]);

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

  it("requires a migrate function for old state files", async () => {
    const workspace = await createWorkspace({ includeMigrate: false });
    await writeOldState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "migrate"
    ]);

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

  it("rejects migrations for state files owned by a different module", async () => {
    const workspace = await createWorkspace();
    await writeStateEnvelope(workspace.statePath, 1, { value: "old" }, "other-module");

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "migrate"
    ]);

    expect(result.exitCode).toBe(3);
    expect(result.json).toMatchObject({
      error: {
        code: "MODULE_STATE_MISMATCH",
        details: {
          stateModule: "other-module",
          module: "migration-phase"
        }
      }
    });
  });
});

async function createWorkspace(options: { includeMigrate?: boolean } = {}): Promise<{
  cwd: string;
  modulePath: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-migration-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const statePath = path.join(cwd, "rp.state.json");
  const includeMigrate = options.includeMigrate ?? true;

  await writeFile(
    modulePath,
    [
      'import { defineModule } from "@rp-cli/core";',
      'import { z } from "zod";',
      "const OldStateSchema = z.object({",
      "  value: z.string()",
      "});",
      "const StateSchema = z.object({",
      "  value: z.string(),",
      "  count: z.number(),",
      "  migratedAt: z.string()",
      "});",
      "export default defineModule({",
      '  name: "migration-phase",',
      "  version: 9,",
      "  state: {",
      "    version: 2,",
      "    schema: StateSchema,",
      '    defaults: () => ({ value: "current", count: 2, migratedAt: "2026-05-03T12:00:00.000Z" })' +
        (includeMigrate
          ? ",\n    migrate({ state, fromVersion, toVersion, ctx }) {\n      const old = OldStateSchema.parse(state);\n      return {\n        value: old.value,\n        count: toVersion - fromVersion,\n        migratedAt: ctx.now()\n      };\n    }"
          : ""),
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, statePath };
}

async function writeOldState(statePath: string): Promise<void> {
  await writeStateEnvelope(statePath, 1, { value: "old" });
}

async function writeCurrentState(statePath: string): Promise<void> {
  await writeStateEnvelope(statePath, 2, {
    value: "current",
    count: 2,
    migratedAt: "2026-05-03T12:00:00.000Z"
  });
}

async function writeStateEnvelope(
  statePath: string,
  schemaVersion: number,
  state: unknown,
  moduleName = "migration-phase"
): Promise<void> {
  await writeFile(
    statePath,
    JSON.stringify({
      rp: {
        module: moduleName,
        moduleVersion: 8,
        schemaVersion,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      state
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
