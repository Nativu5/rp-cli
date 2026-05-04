import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../packages/cli/src/cli.js";

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("creator experience", () => {
  it("lets a creator author a module with only the public core API and use it through the CLI", async () => {
    const workspace = await createWorkspace();

    const initResult = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "init"
    ]);

    expect(initResult.exitCode).toBeUndefined();
    expect(initResult.json.model).toEqual({
      profile: {
        title: "untitled"
      },
      scenes: []
    });

    const actions = await runCli(["--module", workspace.modulePath, "action", "--list"]);
    expect(actions.exitCode).toBeUndefined();
    expect(actions.json).toEqual([{ name: "setTitle", description: "Set the story title." }]);

    const inputSchema = await runCli([
      "--module",
      workspace.modulePath,
      "action",
      "setTitle",
      "--schema"
    ]);
    expect(inputSchema.exitCode).toBeUndefined();
    expect(inputSchema.json).toMatchObject({
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 }
      },
      required: ["title"]
    });

    const actionResult = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "action",
      "setTitle",
      '{"title":"The Lantern Room"}'
    ]);
    expect(actionResult.exitCode).toBeUndefined();
    expect(actionResult.json).toMatchObject({
      result: {
        model: {
          profile: {
            title: "The Lantern Room"
          },
          scenes: []
        }
      },
      message: "Story title updated."
    });

    const promptView = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "view",
      "prompt"
    ]);
    expect(promptView.exitCode).toBeUndefined();
    expect(promptView.json).toEqual({
      title: "The Lantern Room",
      sceneCount: 0
    });

    const validateResult = await runCli([
      "--module",
      workspace.modulePath,
      "--model",
      workspace.modelPath,
      "validate"
    ]);
    expect(validateResult.exitCode).toBeUndefined();
    expect(validateResult.json).toEqual({
      valid: true,
      module: "creator-story",
      moduleVersion: 1,
      schemaVersion: 1
    });
  });
});

async function createWorkspace(): Promise<{
  cwd: string;
  modulePath: string;
  modelPath: string;
}> {
  const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-creator-"));
  await mkdir(cwd, { recursive: true });
  const modulePath = path.join(cwd, "rp.module.ts");
  const modelPath = path.join(cwd, "rp.model.json");

  await writeFile(
    modulePath,
    [
      'import { defineModule, type JsonPatch, type RpActionReturn, type RpView } from "@rp-cli/core";',
      'import { z } from "zod";',
      "",
      "const ModelSchema = z.object({",
      "  profile: z.object({",
      "    title: z.string()",
      "  }),",
      "  scenes: z.array(z.string())",
      "});",
      "",
      "type StoryModel = z.infer<typeof ModelSchema>;",
      "",
      "function replaceTitle(title: string): JsonPatch {",
      "  return [{ op: 'replace', path: '/profile/title', value: title }];",
      "}",
      "",
      "const promptView: RpView<StoryModel> = ({ model }) => ({",
      "  title: model.profile.title,",
      "  sceneCount: model.scenes.length",
      "});",
      "",
      "export default defineModule({",
      '  name: "creator-story",',
      "  version: 1,",
      "  model: {",
      "    version: 1,",
      "    schema: ModelSchema,",
      '    defaults: () => ({ profile: { title: "untitled" }, scenes: [] })',
      "  },",
      "  actions: {",
      "    setTitle: {",
      '      description: "Set the story title.",',
      "      input: z.object({ title: z.string().min(1) }),",
      "      run({ input }): RpActionReturn {",
      "        return {",
      "          patch: replaceTitle(input.title),",
      '          message: "Story title updated."',
      "        };",
      "      }",
      "    }",
      "  },",
      "  views: {",
      "    prompt: promptView",
      "  }",
      "});"
    ].join("\n")
  );

  return { cwd, modulePath, modelPath };
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
