import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import perfectionist from "eslint-plugin-perfectionist";
import svelte from "eslint-plugin-svelte";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.svelte-kit/**"],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      perfectionist.configs["recommended-alphabetical"],
    ],
    files: ["**/*.{js,mjs,ts}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*"],
              message:
                "Relative imports are prohibited to prevent coupling. Use your defined workspace aliases instead.",
            },
          ],
        },
      ],
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
    },
  },

  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message: "🤡 Stop! Core cannot depend on the CLI package.",
              name: "@influenca/cli",
            },
            {
              message:
                "Core cannot depend on cac; keep CLI concerns in packages/cli.",
              name: "cac",
            },
          ],
          patterns: ["@influenca/cli/*"],
        },
      ],
    },
  },

  {
    files: ["packages/cli/src/commands/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message:
                "Command files must stay UI-agnostic; use @clack/prompts in packages/cli/src/main.ts.",
              name: "@clack/prompts",
            },
          ],
          patterns: ["@clack/prompts/*"],
        },
      ],
    },
  },
  {
    extends: [...svelte.configs.recommended],
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        projectService: true,
      },
    },
  },

  {
    extends: [...markdown.configs.recommended],
    files: ["**/*.md"],
    language: "markdown/gfm",
  },

  {
    extends: [json.configs.recommended],
    files: ["**/*.json", "**/*.jsonc"],
    language: "json/jsonc",
  },
);

// import path from "node:path";
// import js from "@eslint/js";
// import { defineConfig, includeIgnoreFile } from "eslint/config";
// import globals from "globals";
// import ts from "typescript-eslint";

// export default defineConfig(
//   js.configs.recommended,
//   ts.configs.recommended,
//   svelte.configs.recommended,
//   {
//     languageOptions: { globals: { ...globals.browser, ...globals.node } },
//   },
//   {
//     // Override or add rule settings here, such as:
//     // 'svelte/button-has-type': 'error'
//     rules: {},
//   },
// );
