import { parseModule } from "./moduleParser.js";
import type {
  AnyZodSchema,
  RpModule,
  RpModuleDefinition,
  SchemaOutput
} from "./types.js";

export function defineModule<
  TStateSchema extends AnyZodSchema,
  TActionInputs extends Record<string, AnyZodSchema> = Record<string, never>
>(
  module: RpModuleDefinition<TStateSchema, TActionInputs>
): RpModule<SchemaOutput<TStateSchema>> {
  return parseModule(module) as RpModule<SchemaOutput<TStateSchema>>;
}
