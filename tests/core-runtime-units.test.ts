import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyJsonPatch, findSummary, readJsonLogEntries, runSummary } from "@rp-cli/core/internal";

describe("core runtime units", () => {
  it("selects default, brief, then the first summary when no name is requested", () => {
    expect(
      findSummary({
        first: () => "first",
        default: () => "default",
        brief: () => "brief"
      }).name
    ).toBe("default");

    expect(
      findSummary({
        first: () => "first",
        brief: () => "brief"
      }).name
    ).toBe("brief");

    expect(
      findSummary({
        first: () => "first"
      }).name
    ).toBe("first");
  });

  it("wraps summary runtime failures", async () => {
    await expect(
      runSummary({
        summary: () => {
          throw new Error("boom");
        },
        state: {},
        meta: {
          module: "unit",
          moduleVersion: 1,
          schemaVersion: 1,
          createdAt: "2026-05-03T12:00:00.000Z",
          updatedAt: "2026-05-03T12:00:00.000Z"
        }
      })
    ).rejects.toMatchObject({
      code: "SUMMARY_RUNTIME_ERROR"
    });
  });

  it("applies JSON Patch without mutating the original state object", () => {
    const state = {
      mood: {
        label: "calm"
      }
    };

    const nextState = applyJsonPatch(state, [
      { op: "replace", path: "/mood/label", value: "happy" }
    ]);

    expect(nextState).toEqual({
      mood: {
        label: "happy"
      }
    });
    expect(state).toEqual({
      mood: {
        label: "calm"
      }
    });
  });

  it("reads JSONL log entries and treats a missing log file as empty", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-core-log-"));
    await mkdir(cwd, { recursive: true });
    const logPath = path.join(cwd, "rp.state.json.log.jsonl");

    expect(await readJsonLogEntries(logPath)).toEqual([]);

    await writeFile(
      logPath,
      [
        JSON.stringify({ type: "patch", index: 1 }),
        JSON.stringify({ type: "action", index: 2 }),
        ""
      ].join("\n")
    );

    expect(await readJsonLogEntries(logPath)).toEqual([
      { type: "patch", index: 1 },
      { type: "action", index: 2 }
    ]);
  });

  it("rejects invalid JSONL log content", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "rp-cli-core-log-"));
    const logPath = path.join(cwd, "rp.state.json.log.jsonl");
    await writeFile(logPath, '{"type":"patch"}\nnot-json\n');

    await expect(readJsonLogEntries(logPath)).rejects.toMatchObject({
      code: "STATE_INVALID_JSON"
    });
  });
});
