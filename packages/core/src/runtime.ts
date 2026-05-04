import { toJSONSchema } from "zod";
import { createRuntimeContext, findAction, runAction, validateActionInput } from "./action.js";
import { RpError } from "./errors.js";
import { appendJsonLogEntry, hashModel, readJsonLogEntries } from "./log.js";
import { compareSchemaVersions, runMigration } from "./migration.js";
import {
  createModelEnvelope,
  pathExists,
  readModelFile,
  updateModelEnvelope,
  writeJsonFileAtomic
} from "./modelFile.js";
import { withModelLock } from "./modelLock.js";
import { loadModule } from "./moduleLoader.js";
import { applyJsonPatch, assertJsonPatch } from "./patch.js";
import type { AnyZodSchema, JsonPatch, RpModelFile, RpPaths } from "./types.js";
import { assertModuleCompatibility, validateAuthorModel, validateModelFile } from "./validation.js";
import { findView, listViews, runView } from "./view.js";

export async function initModelOperation(input: { paths: RpPaths; force?: boolean }): Promise<RpModelFile> {
  return withModelLock(input.paths, async () => {
    if (!input.force && (await pathExists(input.paths.modelPath))) {
      throw new RpError("WRITE_FAILED", `model file already exists: ${input.paths.modelPath}`);
    }

    const module = await loadModule(input.paths.modulePath);
    const defaults = await module.model.defaults();
    const model = validateAuthorModel(module, defaults);
    const envelope = createModelEnvelope(module, model);

    await writeJsonFileAtomic(input.paths.modelPath, envelope);
    return envelope;
  });
}

export async function validateModelOperation(input: { paths: RpPaths }): Promise<{
  valid: true;
  module: string;
  moduleVersion: number;
  schemaVersion: number;
}> {
  const module = await loadModule(input.paths.modulePath);
  const envelope = validateModelFile(module, await readModelFile(input.paths.modelPath));

  return {
    valid: true,
    module: envelope.rp.module,
    moduleVersion: envelope.rp.moduleVersion,
    schemaVersion: envelope.rp.schemaVersion
  };
}

export async function readModelOperation(input: { paths: RpPaths; raw?: boolean; schema?: boolean }): Promise<unknown> {
  const module = await loadModule(input.paths.modulePath);

  if (input.schema) {
    return exportJsonSchema(module.model.schema, "model schema");
  }

  const envelope = validateModelFile(module, await readModelFile(input.paths.modelPath));

  return input.raw ? envelope : envelope.model;
}

export async function listActionSummariesOperation(input: {
  paths: RpPaths;
}): Promise<{ name: string; description: string }[]> {
  const module = await loadModule(input.paths.modulePath);

  return Object.entries(module.actions ?? {}).map(([name, action]) => ({
    name,
    description: action.description
  }));
}

export async function exportActionInputSchemaOperation(input: { paths: RpPaths; name: string }): Promise<unknown> {
  const module = await loadModule(input.paths.modulePath);
  const action = findAction(module.actions, input.name);

  return exportJsonSchema(action.input, "action input schema");
}

export async function runActionOperation(input: {
  paths: RpPaths;
  name: string;
  actionInput: unknown;
  dryRun?: boolean;
  reason?: string;
}): Promise<{
  result: null | {
    patch: JsonPatch;
    model: unknown;
  };
  message?: string;
}> {
  const module = await loadModule(input.paths.modulePath);
  const action = findAction(module.actions, input.name);
  const actionInput = validateActionInput(action, input.actionInput);

  return withModelLock(input.paths, async () => {
    const envelope = validateModelFile(module, await readModelFile(input.paths.modelPath));
    const ctx = createRuntimeContext();
    const result = await runAction({
      action,
      model: envelope.model,
      input: actionInput,
      meta: envelope.rp,
      ctx
    });

    if (result.patch.length === 0) {
      return {
        result: null,
        ...(result.message === undefined ? {} : { message: result.message })
      };
    }

    const nextModel = validateAuthorModel(module, applyJsonPatch(envelope.model, result.patch));
    const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

    if (!input.dryRun) {
      await writeJsonFileAtomic(input.paths.modelPath, nextEnvelope);
      await appendJsonLogEntry(input.paths.logPath, {
        id: ctx.id("log"),
        time: ctx.now(),
        type: "action",
        name: input.name,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        ...(result.reason === undefined ? {} : { actionReason: result.reason }),
        ...(result.message === undefined ? {} : { message: result.message }),
        input: actionInput,
        patch: result.patch,
        modelHashBefore: hashModel(envelope.model),
        modelHashAfter: hashModel(nextModel)
      });
    }

    return {
      result: {
        patch: result.patch,
        model: nextModel
      },
      ...(result.message === undefined ? {} : { message: result.message })
    };
  });
}

export async function applyUpdateOperation(input: {
  paths: RpPaths;
  patch: unknown;
  dryRun?: boolean;
  reason?: string;
}): Promise<{ patch: JsonPatch; model: unknown }> {
  assertJsonPatch(input.patch);
  const patch = input.patch;

  return withModelLock(input.paths, async () => {
    const module = await loadModule(input.paths.modulePath);
    const envelope = validateModelFile(module, await readModelFile(input.paths.modelPath));
    const nextModel = validateAuthorModel(module, applyJsonPatch(envelope.model, patch));
    const ctx = createRuntimeContext();
    const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

    if (!input.dryRun) {
      await writeJsonFileAtomic(input.paths.modelPath, nextEnvelope);
      await appendJsonLogEntry(input.paths.logPath, {
        id: ctx.id("log"),
        time: ctx.now(),
        type: "update",
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        patch,
        modelHashBefore: hashModel(envelope.model),
        modelHashAfter: hashModel(nextModel)
      });
    }

    return {
      patch,
      model: nextModel
    };
  });
}

export async function listViewsOperation(input: { paths: RpPaths }): Promise<{ name: string; description?: string }[]> {
  const module = await loadModule(input.paths.modulePath);

  return listViews(module.views);
}

export async function runViewOperation(input: { paths: RpPaths; name?: string }): Promise<unknown> {
  const module = await loadModule(input.paths.modulePath);
  const view = findView(module.views, input.name);
  const envelope = validateModelFile(module, await readModelFile(input.paths.modelPath));

  return runView({
    view: view.run,
    model: envelope.model,
    meta: envelope.rp
  });
}

export async function migrateModelOperation(input: { paths: RpPaths; dryRun?: boolean; reason?: string }): Promise<{
  fromVersion: number;
  toVersion: number;
  model: unknown;
}> {
  return withModelLock(input.paths, async () => {
    const module = await loadModule(input.paths.modulePath);
    const envelope = await readModelFile(input.paths.modelPath);
    assertModuleCompatibility(envelope.rp, module);
    const fromVersion = envelope.rp.schemaVersion;
    const toVersion = module.model.version;
    const comparison = compareSchemaVersions(fromVersion, toVersion);

    if (comparison === "current") {
      const model = validateAuthorModel(module, envelope.model);

      return { fromVersion, toVersion, model };
    }

    if (comparison === "newer") {
      throw new RpError("MIGRATION_FAILED", "model schemaVersion is newer than module model.version", {
        fromVersion,
        toVersion
      });
    }

    const ctx = createRuntimeContext();
    const nextModel = validateAuthorModel(
      module,
      await runMigration({
        migrate: module.model.migrate,
        model: envelope.model,
        fromVersion,
        toVersion,
        meta: envelope.rp,
        ctx
      })
    );
    const nextEnvelope = updateModelEnvelope(envelope, module, nextModel, ctx.now());

    if (!input.dryRun) {
      await writeJsonFileAtomic(input.paths.modelPath, nextEnvelope);
      await appendJsonLogEntry(input.paths.logPath, {
        id: ctx.id("log"),
        time: ctx.now(),
        type: "migrate",
        fromVersion,
        toVersion,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        modelHashBefore: hashModel(envelope.model),
        modelHashAfter: hashModel(nextModel)
      });
    }

    return { fromVersion, toVersion, model: nextModel };
  });
}

export async function readLogOperation(input: { paths: RpPaths; limit?: number }): Promise<unknown[]> {
  const entries = await readJsonLogEntries(input.paths.logPath);

  return input.limit === undefined ? entries : entries.slice(-input.limit);
}

function exportJsonSchema(schema: AnyZodSchema, description: string): unknown {
  try {
    return toJSONSchema(schema);
  } catch (error) {
    throw new RpError("SCHEMA_EXPORT_FAILED", `failed to export ${description}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
