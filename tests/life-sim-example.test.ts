import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../packages/cli/src/cli.js";

const originalExitCode = process.exitCode;
const lifeSimModulePath = path.resolve("examples/life-sim/rp.module.ts");

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("life-sim example", () => {
  it("runs the documented state lifecycle and write workflow", async () => {
    const workspace = await createWorkspace();

    const initResult = await runLifeSim(workspace.statePath, ["init"]);
    expect(initResult.exitCode).toBeUndefined();
    expect(initResult.json.state).toEqual({
      profile: {},
      mood: {},
      relationships: {},
      memories: []
    });

    const rememberResult = await runLifeSim(workspace.statePath, [
      "--reason",
      "User established this preference.",
      "action",
      "remember",
      '{"text":"Mio likes rainy afternoons.","tags":["preference"],"pinned":true}'
    ]);
    expect(rememberResult.exitCode).toBeUndefined();

    const moodResult = await runLifeSim(workspace.statePath, [
      "--reason",
      "Scene tone changed.",
      "action",
      "setMood",
      '{"label":"flustered but happy","valence":0.68,"arousal":0.4}'
    ]);
    expect(moodResult.exitCode).toBeUndefined();

    const patchResult = await runLifeSim(workspace.statePath, [
      "--reason",
      "Scene moved to a quiet moment.",
      "patch",
      '[{"op":"replace","path":"/mood/label","value":"calm"}]'
    ]);
    expect(patchResult.exitCode).toBeUndefined();

    const promptSummary = await runLifeSim(workspace.statePath, ["summary", "prompt"]);
    expect(promptSummary.exitCode).toBeUndefined();
    expect(promptSummary.json).toMatchObject({
      character: {},
      currentMood: {
        label: "calm",
        valence: 0.68,
        arousal: 0.4
      },
      importantMemories: ["Mio likes rainy afternoons."]
    });

    const stateResult = await runLifeSim(workspace.statePath, ["state"]);
    expect(stateResult.exitCode).toBeUndefined();
    expect(stateResult.json.memories).toHaveLength(1);
    expect(stateResult.json.memories[0]).toMatchObject({
      text: "Mio likes rainy afternoons.",
      tags: ["preference"],
      pinned: true
    });

    const validateResult = await runLifeSim(workspace.statePath, ["validate"]);
    expect(validateResult.exitCode).toBeUndefined();

    const migrateResult = await runLifeSim(workspace.statePath, ["migrate"]);
    expect(migrateResult.exitCode).toBeUndefined();
    expect(migrateResult.json).toMatchObject({
      fromVersion: 1,
      toVersion: 1
    });

    const logResult = await runLifeSim(workspace.statePath, ["log", "--limit", "2"]);
    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toHaveLength(2);
    expect(logResult.json.map((entry: any) => entry.type)).toEqual(["action", "patch"]);
  });

  it("exposes action, summary, and schema discovery for the example module", async () => {
    const workspace = await createWorkspace();

    const actions = await runLifeSim(workspace.statePath, ["action", "--list"]);
    expect(actions.exitCode).toBeUndefined();
    expect(actions.json).toEqual(
      expect.arrayContaining([
        { name: "remember", description: "Add a long-term memory." },
        { name: "setMood", description: "Update current mood." }
      ])
    );

    const summaries = await runLifeSim(workspace.statePath, ["summary", "--list"]);
    expect(summaries.exitCode).toBeUndefined();
    expect(summaries.json).toEqual(
      expect.arrayContaining([{ name: "default" }, { name: "prompt" }])
    );

    const actionSchema = await runLifeSim(workspace.statePath, ["schema", "action", "setMood"]);
    expect(actionSchema.exitCode).toBeUndefined();
    expect(actionSchema.json).toMatchObject({
      type: "object",
      properties: {
        label: { type: "string" },
        valence: { type: "number", minimum: -1, maximum: 1 },
        arousal: { type: "number", minimum: 0, maximum: 1 },
        stress: { type: "number", minimum: 0, maximum: 1 }
      }
    });
  });

  it("migrates an old life-sim state envelope to the current schema", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      workspace.statePath,
      JSON.stringify({
        rp: {
          module: "life-sim",
          moduleVersion: 1,
          schemaVersion: 0,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        state: {
          profile: { name: "Mio" },
          mood: { label: "curious" }
        }
      })
    );

    const result = await runLifeSim(workspace.statePath, ["migrate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 0,
      toVersion: 1,
      state: {
        profile: { name: "Mio" },
        mood: { label: "curious" },
        relationships: {},
        memories: []
      }
    });
  });

  it("rejects invalid input, invalid patches, and schema-violating patch results", async () => {
    const workspace = await createWorkspace();
    await runLifeSim(workspace.statePath, ["init"]);

    const invalidInput = await runLifeSim(workspace.statePath, [
      "action",
      "setMood",
      '{"valence":2}'
    ]);
    expect(invalidInput.exitCode).toBe(6);
    expect(invalidInput.json).toMatchObject({
      error: {
        code: "ACTION_INPUT_INVALID"
      }
    });

    const invalidPatch = await runLifeSim(workspace.statePath, [
      "patch",
      '{"op":"replace","path":"/mood/label","value":"bad"}'
    ]);
    expect(invalidPatch.exitCode).toBe(7);
    expect(invalidPatch.json).toMatchObject({
      error: {
        code: "PATCH_INVALID"
      }
    });

    const schemaViolation = await runLifeSim(workspace.statePath, [
      "patch",
      '[{"op":"add","path":"/mood/valence","value":2}]'
    ]);
    expect(schemaViolation.exitCode).toBe(5);
    expect(schemaViolation.json).toMatchObject({
      error: {
        code: "VALIDATION_ERROR"
      }
    });
  });

  it("documents the complete life-sim command flow", async () => {
    const readme = await readFile(
      new URL("../examples/life-sim/README.md", import.meta.url),
      "utf8"
    );

    expect(readme).toContain("action remember");
    expect(readme).toContain("action setMood");
    expect(readme).toContain("summary prompt");
    expect(readme).toContain("schema action setMood");
    expect(readme).toContain("log --limit 5");
    expect(readme).toContain("--reason");
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  statePath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-life-sim-"));
  await mkdir(cwd, { recursive: true });

  return {
    cwd,
    statePath: path.join(cwd, "mio.json")
  };
}

async function runLifeSim(
  statePath: string,
  args: string[]
): Promise<{
  stdout: string;
  json: any;
  exitCode: string | number | undefined;
}> {
  return runCli(["--module", lifeSimModulePath, "--state", statePath, ...args]);
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
