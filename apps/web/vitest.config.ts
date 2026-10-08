import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      expect: { requireAssertions: true },
      include: ["src/**/*.{test,spec}.{js,ts}"],
      root: webRoot,
    },
  }),
);
