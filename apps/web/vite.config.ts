import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Keep this here so standard Vite systems (like route building) can locate it too
  envDir: "../../",
  plugins: [
    sveltekit({
      adapter: adapter(),
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      env: {
        dir: "../../",
      },
    }),
  ],
});
