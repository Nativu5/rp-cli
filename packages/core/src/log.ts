import { createHash } from "node:crypto";

export function hashState(value: unknown): string {
  const json = JSON.stringify(value);
  const digest = createHash("sha256").update(json).digest("hex");

  return `sha256:${digest}`;
}
