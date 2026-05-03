import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@rp-cli/core/internal",
        replacement: fileURLToPath(
          new URL("./packages/core/src/internal.ts", import.meta.url)
        )
      },
      {
        find: "@rp-cli/core",
        replacement: fileURLToPath(
          new URL("./packages/core/src/index.ts", import.meta.url)
        )
      },
      {
        find: "@rp-cli/cli",
        replacement: fileURLToPath(
          new URL("./packages/cli/src/cli.ts", import.meta.url)
        )
      }
    ]
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false
  }
});
