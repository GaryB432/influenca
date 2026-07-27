import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter(),
      env: {
        dir: "../../",
      },
      alias: {
        "@influenca/core": "../../libraries/core/src/index.ts",
      },
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
    }),
  ],
  // Keep this here so standard Vite systems (like route building) can locate it too
  envDir: "../../",
});
