import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import perfectionist from "eslint-plugin-perfectionist";
import { yaml } from "eslint-yaml";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: { globals: globals.node },
    ...js.configs.recommended,
    ...perfectionist.configs["recommended-natural"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.json"],
    language: "json/jsonc",
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.md"],
    language: "markdown/gfm",
    plugins: { markdown },
    rules: { ...markdown.configs.recommended.rules },
  },
  {
    files: ["*.yaml", "*.yml"],
    ignores: ["**/pnpm-lock.yaml"],
    language: "yaml/yaml",
    plugins: { yaml },
    rules: {
      "yaml/no-empty-mapping-value": "error",
    },
  },
  {
    ignores: [
      ".git",
      "**/node_modules",
      "**/dist",
      "**/.svelte-kit",
      "**/build",
      "tmp",
    ],
  },
]);
