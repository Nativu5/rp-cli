import { mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDirectCliExecution } from "../packages/cli/src/cli.js";

describe("release readiness", () => {
  it("detects direct CLI execution through an npm bin symlink", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "rp-cli-bin-"));
    const binPath = path.join(workspace, "rp");
    await symlink(path.resolve("packages/cli/src/cli.ts"), binPath);

    expect(isDirectCliExecution(binPath)).toBe(true);
  });

  it("keeps npm packages scoped to generated runtime artifacts", async () => {
    const packagePaths = ["packages/core/package.json", "packages/cli/package.json"];

    for (const packagePath of packagePaths) {
      const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
        bin?: Record<string, string>;
        files?: string[];
        scripts?: Record<string, string>;
      };

      expect(packageJson.files).toEqual(["dist"]);
      expect(packageJson.scripts?.clean).toBeDefined();
      expect(packageJson.scripts?.build).toMatch(/^npm run clean && tsc -p tsconfig\.json$/);
      expect(packageJson.scripts?.prepack).toBe("npm run build");

      if (packageJson.bin?.rp) {
        expect(packageJson.scripts?.prebuild).toBe("npm run build -w @rp-cli/core");
        expect(packageJson.scripts?.postbuild).toBe("chmod +x dist/cli.js");
      }
    }
  });

  it("keeps workspace package tsconfigs valid when opened through node_modules symlinks", async () => {
    const tsconfigPaths = ["packages/core/tsconfig.json", "packages/cli/tsconfig.json"];

    for (const tsconfigPath of tsconfigPaths) {
      const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8")) as {
        extends?: string;
      };

      expect(tsconfig.extends).toBeUndefined();
    }
  });
});
