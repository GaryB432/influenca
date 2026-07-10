import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";

export default [
  {
    extends: ["js/recommended"],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: { globals: globals.browser },
    plugins: { js },
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.jsonc"],
    language: "json/jsonc",
    plugins: { json },
  },
  {
    extends: ["json/recommended"],
    files: ["**/*.json5"],
    language: "json/json5",
    plugins: { json },
  },
  {
    extends: ["markdown/recommended"],
    files: ["**/*.md"],
    language: "markdown/gfm",
    plugins: { markdown },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      import: importPlugin,
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              from: "./packages/cli",
              message: "Core must remain independent from the CLI package.",
              target: "./packages/core",
            },
          ],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              message: "Core cannot depend on @influenca/cli.",
              name: "@influenca/cli",
            },
            {
              message:
                "Core cannot depend on cac; keep CLI parsing concerns in packages/cli.",
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
  tseslint.configs.recommended,
  perfectionist.configs["recommended-alphabetical"],
];
