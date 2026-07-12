import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import perfectionist from "eslint-plugin-perfectionist";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },

  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      perfectionist.configs["recommended-alphabetical"],
    ],
    files: ["**/*.{js,mjs,ts}"],
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
                "Command files must stay UI-agnostic; use @clack/prompts in packages/cli/src/bin.ts.",
              name: "@clack/prompts",
            },
          ],
          patterns: ["@clack/prompts/*"],
        },
      ],
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
