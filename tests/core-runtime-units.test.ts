import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyJsonPatch, findView, readJsonLogEntries, runView } from "@rp-cli/core/internal";

describe("core runtime units", () => {
  it("selects default, brief, then the first view when no name is requested", () => {
    expect(
      findView({
        first: () => "first",
        default: () => "default",
        brief: () => "brief"
      }).name
    ).toBe("default");

    expect(
      findView({
        first: () => "first",
        brief: () => "brief"
      }).name
    ).toBe("brief");

    expect(
      findView({
        first: () => "first"
      }).name
    ).toBe("first");
  });

  it("wraps view runtime failures", async () => {
    await expect(
      runView({
        view: () => {
          throw new Error("boom");
        },
        model: {},
        meta: {
          module: "unit",
          moduleVersion: 1,
          schemaVersion: 1,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        }
      })
    ).rejects.toMatchObject({
      code: "VIEW_RUNTIME_ERROR"
    });
  });

  it("applies JSON Patch without mutating the original model object", () => {
    const model = {
      mood: {
        label: "calm"
      }
    };

    const nextModel = applyJsonPatch(model, [
      { op: "replace", path: "/mood/label", value: "happy" }
    ]);

    expect(nextModel).toEqual({
      mood: {
        label: "happy"
      }
    });
    expect(model).toEqual({
      mood: {
        label: "calm"
      }
    });
  });

  it("reads JSONL log entries and treats a missing log file as empty", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-core-log-"));
    await mkdir(cwd, { recursive: true });
    const logPath = path.join(cwd, "rp.model.json.log.jsonl");

    expect(await readJsonLogEntries(logPath)).toEqual([]);

    await writeFile(
      logPath,
      [
        JSON.stringify({ type: "update", index: 1 }),
        JSON.stringify({ type: "action", index: 2 }),
        ""
      ].join("\n")
    );

    expect(await readJsonLogEntries(logPath)).toEqual([
      { type: "update", index: 1 },
      { type: "action", index: 2 }
    ]);
  });

  it("rejects invalid JSONL log content", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-core-log-"));
    const logPath = path.join(cwd, "rp.model.json.log.jsonl");
    await writeFile(logPath, '{"type":"update"}\nnot-json\n');

    await expect(readJsonLogEntries(logPath)).rejects.toMatchObject({
      code: "MODEL_INVALID_JSON"
    });
  });
});
