import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@influenca/core": fileURLToPath(
        new URL("../../libraries/core/src/index.ts", import.meta.url),
      ),
      "@influenca/shared": fileURLToPath(
        new URL("../../libraries/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "cli",
    passWithNoTests: true,
  },
});
