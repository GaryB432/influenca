import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
      // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
      // See https://svelte.dev/docs/kit/adapters for more information about adapters.
      adapter: adapter(),

      alias: {
        "@influenca/core": "../../packages/core/src/index.ts",
      },
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
    }),
  ],
  server: {
    watch: {
      ignored: ["**/corpus/**"],
    },
  },
});

// kit: {
//   alias: {
//     // this will match a file
//     "@influenca/core": "",

//     // this will match a directory and its contents
//     // (`my-directory/x` resolves to `path/to/my-directory/x`)
//     "my-directory": "path/to/my-directory",

//     // an alias ending /* will only match
//     // the contents of a directory, not the directory itself
//     "my-directory/*": "path/to/my-directory/*",
//   },
// },
