import type { Operation } from "fast-json-patch";
import type { ZodType } from "zod";

export type JsonPatchOperation = Operation;
export type JsonPatch = JsonPatchOperation[];

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
  input: ZodType<TInput>;
  run(args: {
    state: Readonly<TState>;
    input: TInput;
    meta: RpMeta;
    ctx: RpActionContext;
  }): RpActionReturn | Promise<RpActionReturn>;
}

export type RpSummaryFunction<TState = unknown> = (args: {
  state: Readonly<TState>;
  meta: RpMeta;
}) => unknown | Promise<unknown>;

export interface RpSummaryObject<TState = unknown> {
  description?: string;
  run: RpSummaryFunction<TState>;
}

export type RpSummary<TState = unknown> =
  | RpSummaryFunction<TState>
  | RpSummaryObject<TState>;

export interface RpMigration<TState = unknown> {
  (args: {
    state: unknown;
    fromVersion: number;
    toVersion: number;
    meta: RpMeta;
    ctx: RpMigrationContext;
  }): TState | Promise<TState>;
}

export interface RpModule<TState = unknown> {
  name: string;
  version: number;
  state: {
    version: number;
    schema: ZodType<TState>;
    defaults: () => TState | Promise<TState>;
    migrate?: RpMigration<TState>;
  };
  actions?: Record<string, RpAction<TState, unknown>>;
  summaries?: Record<string, RpSummary<TState>>;
}

export interface RpPaths {
  modulePath: string;
  statePath: string;
  logPath: string;
  lockPath: string;
}
