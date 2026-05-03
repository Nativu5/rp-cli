import type { RpModule } from "./types.js";

export function defineModule<TState>(module: RpModule<TState>): RpModule<TState> {
  return module;
}
