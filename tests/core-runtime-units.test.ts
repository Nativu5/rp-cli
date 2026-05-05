import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RpError } from "../packages/core/src/errors.js";
import { readJsonLogEntries } from "../packages/core/src/log.js";
import { applyJsonPatch } from "../packages/core/src/patch.js";
import { findView, runView } from "../packages/core/src/view.js";

describe("core runtime units", () => {
  it("requires a view name", () => {
    let error: unknown;

    try {
      findView(
        {
          first: () => "first",
          default: () => "default",
          brief: () => "brief"
        },
        ""
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(RpError);
    expect(error).toMatchObject({
      code: "VIEW_NOT_FOUND"
    });
  });

  it("selects a named view", () => {
    expect(
      findView(
        {
          first: () => "first",
          default: () => "default",
          brief: () => "brief"
        },
        "brief"
      ).name
    ).toBe("brief");
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

    const nextModel = applyJsonPatch(model, [{ op: "replace", path: "/mood/label", value: "happy" }]);

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
      [JSON.stringify({ type: "update", index: 1 }), JSON.stringify({ type: "action", index: 2 }), ""].join("\n")
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
      code: "LOG_INVALID_JSON"
    });
  });

  it("reports log read failures separately from model file failures", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-core-log-"));
    const logPath = path.join(cwd, "rp.model.json.log.jsonl");
    await mkdir(logPath);

    await expect(readJsonLogEntries(logPath)).rejects.toMatchObject({
      code: "LOG_READ_FAILED"
    });
  });
});
