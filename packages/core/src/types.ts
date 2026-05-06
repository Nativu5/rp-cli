import type { Operation } from "fast-json-patch";
import type { output, ZodType } from "zod";

export type JsonPatchOperation = Operation;
export type JsonPatch = JsonPatchOperation[];
export type MaybePromise<T> = T | Promise<T>;
export type AnyZodSchema = ZodType<unknown, unknown>;
export type SchemaOutput<TSchema extends AnyZodSchema> = output<TSchema>;

export interface RpMeta {
  module: string;
  moduleVersion: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RpModelFile<TModel = unknown> {
  rp: RpMeta;
  model: TModel;
}

export interface RpRuntimeContext {
  now(): string;
  id(prefix?: string): string;
}

export type RpActionContext = RpRuntimeContext;
export type RpMigrationContext = RpRuntimeContext;

export interface RpActionReturn {
  patch: JsonPatch;
  reason?: string;
  message?: string;
}

export interface RpAction<TModel = unknown, TInput = unknown> {
  description: string;
  input: ZodType<TInput, unknown>;
  run(args: {
    model: Readonly<TModel>;
    input: TInput;
    meta: RpMeta;
    ctx: RpActionContext;
  }): MaybePromise<RpActionReturn>;
}

export interface RpActionDefinition<TModel = unknown, TInputSchema extends AnyZodSchema = AnyZodSchema> {
  description: string;
  input: TInputSchema;
  run(args: {
    model: Readonly<TModel>;
    input: SchemaOutput<TInputSchema>;
    meta: RpMeta;
    ctx: RpActionContext;
  }): MaybePromise<RpActionReturn>;
}

export type RpActionDefinitions<TModel, TActions> = {
  [TName in keyof TActions]: TActions[TName] extends AnyZodSchema ? RpActionDefinition<TModel, TActions[TName]> : never;
};

export type RpViewFunction<TModel = unknown> = (args: { model: TModel; meta: RpMeta }) => MaybePromise<unknown>;

export interface RpViewObject<TModel = unknown> {
  description?: string;
  run: RpViewFunction<TModel>;
}

export type RpView<TModel = unknown> = RpViewFunction<TModel> | RpViewObject<TModel>;

export interface RpMigration<TModel = unknown> {
  (args: {
    model: unknown;
    fromVersion: number;
    toVersion: number;
    meta: RpMeta;
    ctx: RpMigrationContext;
  }): MaybePromise<TModel>;
}

export interface RpModule<TModel = unknown> {
  name: string;
  version: number;
  model: {
    version: number;
    schema: ZodType<TModel, unknown>;
    defaults: () => MaybePromise<TModel>;
    migrate?: RpMigration<TModel>;
  };
  actions?: Record<string, RpAction<TModel, unknown>>;
  views?: Record<string, RpView<TModel>>;
}

export type RpModuleDefinition<
  TModelSchema extends AnyZodSchema,
  TActionInputs extends Record<string, AnyZodSchema> = Record<string, never>
> = {
  name: string;
  version: number;
  model: {
    version: number;
    schema: TModelSchema;
    defaults: () => MaybePromise<SchemaOutput<TModelSchema>>;
    migrate?: RpMigration<SchemaOutput<TModelSchema>>;
  };
  actions?: RpActionDefinitions<SchemaOutput<TModelSchema>, TActionInputs>;
  views?: Record<string, RpView<SchemaOutput<TModelSchema>>>;
};

export interface RpPaths {
  modulePath: string;
  modelPath: string;
  logPath: string;
  lockPath: string;
}
