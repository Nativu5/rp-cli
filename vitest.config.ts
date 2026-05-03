import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@rp-cli/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url)
      ),
      "@rp-cli/cli": fileURLToPath(
        new URL("./packages/cli/src/cli.ts", import.meta.url)
      )
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false
  }
});
