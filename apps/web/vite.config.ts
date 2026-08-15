import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const baseDir = "../../";

export default defineConfig({
  // Keep this here so standard Vite systems (like route building) can locate it too
  envDir: baseDir,
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      env: {
        dir: baseDir,
      },
    }),
  ],
  resolve: {
    alias: {
      "@influenca/core": resolve(baseDir, "libraries/core/src/index.ts"),
    },
  },
});
