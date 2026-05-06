import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../packages/cli/src/cli.js";

const originalExitCode = process.exitCode;
const lifeSimModulePath = path.resolve("examples/life-sim/src/rp.module.js");

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("life-sim example", () => {
  it("runs the documented model lifecycle and write workflow", async () => {
    const workspace = await createWorkspace();

    const initResult = await runLifeSim(workspace.modelPath, ["init"]);
    expect(initResult.exitCode).toBeUndefined();
    expect(initResult.json.model).toEqual({
      profile: {},
      mood: {},
      relationships: {},
      level: 1,
      wear: {}
    });

    const moodResult = await runLifeSim(workspace.modelPath, [
      "--reason",
      "Scene tone changed.",
      "action",
      "setMood",
      '{"label":"flustered but happy","valence":0.68,"arousal":0.4,"stress":0.3}'
    ]);
    expect(moodResult.exitCode).toBeUndefined();

    const levelResult = await runLifeSim(workspace.modelPath, ["action", "levelUp", "{}"]);
    expect(levelResult.exitCode).toBeUndefined();

    const wearResult = await runLifeSim(workspace.modelPath, [
      "--reason",
      "Mio changed for the next scene.",
      "action",
      "setWear",
      '{"top":"blue blouse","bottom":"gray skirt"}'
    ]);
    expect(wearResult.exitCode).toBeUndefined();

    const updateResult = await runLifeSim(workspace.modelPath, [
      "--reason",
      "Scene moved to a quiet moment.",
      "update",
      '[{"op":"replace","path":"/mood/label","value":"calm"}]'
    ]);
    expect(updateResult.exitCode).toBeUndefined();

    const backgroundView = await runLifeSim(workspace.modelPath, ["view", "MioBackground"]);
    expect(backgroundView.exitCode).toBeUndefined();
    expect(backgroundView.json).toMatchObject({
      name: "Mio",
      background: expect.stringContaining("Mio"),
      currentMood: {
        label: "calm",
        valence: 0.68,
        arousal: 0.4,
        stress: 0.3
      },
      level: 2,
      wearing: {
        top: "blue blouse",
        bottom: "gray skirt"
      }
    });

    const moodView = await runLifeSim(workspace.modelPath, ["view", "MioMood"]);
    expect(moodView.exitCode).toBeUndefined();
    expect(moodView.json.stress).toBeGreaterThanOrEqual(0.2);
    expect(moodView.json.stress).toBeLessThanOrEqual(0.6);

    const envelopeAfterMoodView = JSON.parse(await readFile(workspace.modelPath, "utf8"));
    expect(envelopeAfterMoodView.model.mood.stress).toBe(moodView.json.stress);

    const modelResult = await runLifeSim(workspace.modelPath, ["model"]);
    expect(modelResult.exitCode).toBeUndefined();
    expect(modelResult.json).toMatchObject({
      level: 2,
      mood: {
        label: "calm"
      },
      wear: {
        top: "blue blouse",
        bottom: "gray skirt"
      }
    });

    const validateResult = await runLifeSim(workspace.modelPath, ["validate"]);
    expect(validateResult.exitCode).toBeUndefined();

    const migrateResult = await runLifeSim(workspace.modelPath, ["migrate"]);
    expect(migrateResult.exitCode).toBeUndefined();
    expect(migrateResult.json).toMatchObject({
      fromVersion: 1,
      toVersion: 1
    });

    const logResult = await runLifeSim(workspace.modelPath, ["log", "--limit", "3"]);
    expect(logResult.exitCode).toBeUndefined();
    expect(logResult.json).toHaveLength(3);
    expect(logResult.json.map((entry: any) => entry.type)).toEqual(["action", "update", "view"]);
  });

  it("exposes action, view, and schema discovery for the example module", async () => {
    const workspace = await createWorkspace();

    const actions = await runLifeSim(workspace.modelPath, ["action", "--list"]);
    expect(actions.exitCode).toBeUndefined();
    expect(actions.json).toEqual(
      expect.arrayContaining([
        { name: "setMood", description: "Update current mood." },
        { name: "setLevel", description: "Set the character level." },
        { name: "levelUp", description: "Increase level by 1." },
        { name: "setWear", description: "Update worn items." },
        { name: "removeWear", description: "Remove a worn item." }
      ])
    );

    const views = await runLifeSim(workspace.modelPath, ["view", "--list"]);
    expect(views.exitCode).toBeUndefined();
    expect(views.json.map((view: any) => view.name)).toEqual(["summary", "MioBackground", "MioMood"]);

    const actionSchema = await runLifeSim(workspace.modelPath, ["action", "setMood", "--schema"]);
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

  it("migrates an old life-sim model envelope to the current schema", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      workspace.modelPath,
      JSON.stringify({
        rp: {
          module: "life-sim",
          moduleVersion: 1,
          schemaVersion: 0,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        },
        model: {
          profile: { name: "Mio" },
          mood: { label: "curious" }
        }
      })
    );

    const result = await runLifeSim(workspace.modelPath, ["migrate"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.json).toMatchObject({
      fromVersion: 0,
      toVersion: 1,
      model: {
        profile: { name: "Mio" },
        mood: { label: "curious" },
        relationships: {},
        level: 1,
        wear: {}
      }
    });
  });

  it("rejects invalid input, invalid patches, and schema-violating update results", async () => {
    const workspace = await createWorkspace();
    await runLifeSim(workspace.modelPath, ["init"]);

    const invalidInput = await runLifeSim(workspace.modelPath, ["action", "setMood", '{"valence":2}']);
    expect(invalidInput.exitCode).toBe(6);
    expect(invalidInput.json).toMatchObject({
      error: {
        code: "ACTION_INPUT_INVALID"
      }
    });

    const invalidPatch = await runLifeSim(workspace.modelPath, [
      "update",
      '{"op":"replace","path":"/mood/label","value":"bad"}'
    ]);
    expect(invalidPatch.exitCode).toBe(7);
    expect(invalidPatch.json).toMatchObject({
      error: {
        code: "PATCH_INVALID"
      }
    });

    const schemaViolation = await runLifeSim(workspace.modelPath, [
      "update",
      '[{"op":"add","path":"/mood/valence","value":2}]'
    ]);
    expect(schemaViolation.exitCode).toBe(5);
    expect(schemaViolation.json).toMatchObject({
      error: {
        code: "MODEL_VALIDATION_ERROR"
      }
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-life-sim-"));
  await mkdir(cwd, { recursive: true });

  return {
    cwd,
    modelPath: path.join(cwd, "mio.json")
  };
}

async function runLifeSim(
  modelPath: string,
  args: string[]
): Promise<{
  stdout: string;
  json: any;
  exitCode: string | number | undefined;
}> {
  return runCli(["--module", lifeSimModulePath, "--model", modelPath, ...args]);
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
