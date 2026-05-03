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

export interface RpStateFile<TState = unknown> {
  rp: RpMeta;
  state: TState;
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

export interface RpAction<TState = unknown, TInput = unknown> {
  description: string;
  input: ZodType<TInput, unknown>;
  run(args: {
    state: Readonly<TState>;
    input: TInput;
    meta: RpMeta;
    ctx: RpActionContext;
  }): MaybePromise<RpActionReturn>;
}

export interface RpActionDefinition<
  TState = unknown,
  TInputSchema extends AnyZodSchema = AnyZodSchema
> {
  description: string;
  input: TInputSchema;
  run(args: {
    state: Readonly<TState>;
    input: SchemaOutput<TInputSchema>;
    meta: RpMeta;
    ctx: RpActionContext;
  }): MaybePromise<RpActionReturn>;
}

export type RpActionDefinitions<TState, TActions> = {
  [TName in keyof TActions]: TActions[TName] extends AnyZodSchema
    ? RpActionDefinition<TState, TActions[TName]>
    : never;
};

export type RpSummaryFunction<TState = unknown> = (args: {
  state: Readonly<TState>;
  meta: RpMeta;
}) => MaybePromise<unknown>;

export interface RpSummaryObject<TState = unknown> {
  description?: string;
  run: RpSummaryFunction<TState>;
}

export type RpSummary<TState = unknown> = RpSummaryFunction<TState> | RpSummaryObject<TState>;

export interface RpMigration<TState = unknown> {
  (args: {
    state: unknown;
    fromVersion: number;
    toVersion: number;
    meta: RpMeta;
    ctx: RpMigrationContext;
  }): MaybePromise<TState>;
}

export interface RpModule<TState = unknown> {
  name: string;
  version: number;
  state: {
    version: number;
    schema: ZodType<TState, unknown>;
    defaults: () => MaybePromise<TState>;
    migrate?: RpMigration<TState>;
  };
  actions?: Record<string, RpAction<TState, unknown>>;
  summaries?: Record<string, RpSummary<TState>>;
}

export type RpModuleDefinition<
  TStateSchema extends AnyZodSchema,
  TActionInputs extends Record<string, AnyZodSchema> = Record<string, never>
> = {
  name: string;
  version: number;
  state: {
    version: number;
    schema: TStateSchema;
    defaults: () => MaybePromise<SchemaOutput<TStateSchema>>;
    migrate?: RpMigration<SchemaOutput<TStateSchema>>;
  };
  actions?: RpActionDefinitions<SchemaOutput<TStateSchema>, TActionInputs>;
  summaries?: Record<string, RpSummary<SchemaOutput<TStateSchema>>>;
};

export interface RpPaths {
  modulePath: string;
  statePath: string;
  logPath: string;
  lockPath: string;
}
