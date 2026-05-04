import { parseModule } from "./module.js";
import type { AnyZodSchema, RpModule, RpModuleDefinition, SchemaOutput } from "./types.js";

export function defineModule<
  TModelSchema extends AnyZodSchema,
  TActionInputs extends Record<string, AnyZodSchema> = Record<string, never>
>(module: RpModuleDefinition<TModelSchema, TActionInputs>): RpModule<SchemaOutput<TModelSchema>> {
  return parseModule(module) as RpModule<SchemaOutput<TModelSchema>>;
}
