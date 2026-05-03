import path from "node:path";
import type { RpPaths } from "./types.js";

export const DEFAULT_MODULE_PATH = "./rp.module.ts";
export const DEFAULT_STATE_PATH = "./rp.state.json";

export function resolveRpPaths(options: {
  modulePath?: string;
  statePath?: string;
  cwd?: string;
}): RpPaths {
  const cwd = options.cwd ?? process.cwd();
  const modulePath = path.resolve(
    cwd,
    options.modulePath ?? process.env.RP_MODULE ?? DEFAULT_MODULE_PATH
  );
  const statePath = path.resolve(
    cwd,
    options.statePath ?? process.env.RP_STATE ?? DEFAULT_STATE_PATH
  );

  return {
    modulePath,
    statePath,
    logPath: `${statePath}.log.jsonl`,
    lockPath: `${statePath}.lock`
  };
}
