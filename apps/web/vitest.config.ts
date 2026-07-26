import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      expect: { requireAssertions: true },
      projects: [
        {
          extends: true,
          test: {
            browser: {
              enabled: true,
              instances: [{ browser: "chromium", headless: true }],
              provider: playwright(),
            },
            include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
            name: "client",
          },
        },
        {
          extends: true,
          test: {
            environment: "node",
            exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
            include: ["src/**/*.{test,spec}.{js,ts}"],
            name: "server",
          },
        },
      ],
      root: webRoot,
    },
  }),
);
