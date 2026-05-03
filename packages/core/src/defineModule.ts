import { parseModule } from "./moduleParser.js";
import type { RpModule } from "./types.js";

export function defineModule<TState>(module: RpModule<TState>): RpModule<TState> {
  return parseModule(module) as RpModule<TState>;
}
