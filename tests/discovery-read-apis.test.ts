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
  it("lists summaries without reading the state file", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary",
      "--list"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual([
      { name: "default", description: "Full summary." },
      { name: "brief" },
      { name: "debug", description: "Debug summary." },
      { name: "explode", description: "Throw an error." }
    ]);
  });

  it("runs the default summary against the validated current state", async () => {
    const workspace = await createWorkspace();
    await writeCurrentState(workspace.statePath);
    const before = await readFile(workspace.statePath, "utf8");

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      kind: "default",
      value: "ready",
      count: 1,
      module: "discovery-phase"
    });
    expect(await readFile(workspace.statePath, "utf8")).toBe(before);
  });

  it("runs a named summary", async () => {
    const workspace = await createWorkspace();
    await writeCurrentState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary",
      "debug"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      raw: {
        value: "ready",
        count: 1
      },
      schemaVersion: 1
    });
  });

  it("falls back to the brief summary when no default summary exists", async () => {
    const workspace = await createWorkspace({ includeDefaultSummary: false });
    await writeCurrentState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      kind: "brief",
      value: "ready"
    });
  });

  it("falls back to the first summary when default and brief are missing", async () => {
    const workspace = await createWorkspace({
      includeDefaultSummary: false,
      includeBriefSummary: false
    });
    await writeCurrentState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary"
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toEqual({
      raw: {
        value: "ready",
        count: 1
      },
      schemaVersion: 1
    });
  });

  it("reports summary runtime errors", async () => {
    const workspace = await createWorkspace();
    await writeCurrentState(workspace.statePath);

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "summary",
      "explode"
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.json).toMatchObject({
      error: {
        code: "SUMMARY_RUNTIME_ERROR"
      }
    });
  });

  it("outputs the state JSON Schema by default", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "schema"
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

  it("outputs the state JSON Schema for the explicit state target", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "schema",
      "state"
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

  it("outputs an action input JSON Schema", async () => {
    const workspace = await createWorkspace();

    const result = await runCli([
      "--module",
      workspace.modulePath,
      "--state",
      workspace.statePath,
      "schema",
      "action",
      "setValue"
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
      "--state",
      workspace.statePath,
      "schema",
      "action",
      "missing"
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
    includeDefaultSummary?: boolean;
    includeBriefSummary?: boolean;
  } = {}
): Promise<{
  cwd: string;
  modulePath: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-discovery-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const statePath = path.join(cwd, "rp.state.json");
  const includeDefaultSummary = options.includeDefaultSummary ?? true;
  const includeBriefSummary = options.includeBriefSummary ?? true;

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
      '  name: "discovery-phase",',
      "  version: 4,",
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
      "        return { patch: [{ op: 'replace', path: '/value', value: input.value }] };",
      "      }",
      "    }",
      "  },",
      "  summaries: {",
      ...(includeDefaultSummary
        ? [
            "    default: {",
            '      description: "Full summary.",',
            "      run: ({ state, meta }) => ({",
            '        kind: "default",',
            "        value: state.value,",
            "        count: state.count,",
            "        module: meta.module",
            "      })",
            "    },"
          ]
        : []),
      ...(includeBriefSummary
        ? ["    brief: ({ state }) => ({ kind: 'brief', value: state.value }),"]
        : []),
      "    debug: {",
      '      description: "Debug summary.",',
      "      run: ({ state, meta }) => ({ raw: state, schemaVersion: meta.schemaVersion })",
      "    },",
      "    explode: {",
      '      description: "Throw an error.",',
      "      run: () => { throw new Error('boom'); }",
      "    }",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, statePath };
}

async function writeCurrentState(statePath: string): Promise<void> {
  await writeFile(
    statePath,
    JSON.stringify({
      rp: {
        module: "discovery-phase",
        moduleVersion: 4,
        schemaVersion: 1,
        createdAt: "2026-05-03T12:00:00.000Z",
        updatedAt: "2026-05-03T12:00:00.000Z"
      },
      state: {
        value: "ready",
        count: 1
      }
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
