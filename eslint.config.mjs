import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import perfectionist from "eslint-plugin-perfectionist";
import svelte from "eslint-plugin-svelte";
import { yaml } from "eslint-yaml";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,svelte}"],
    languageOptions: { globals: globals.node },
    ...js.configs.recommended,
    ...perfectionist.configs["recommended-natural"],
  },
  {
    // Sorting is for sets with no order of their own: imports, object keys, unions.
    // A module's members and a type's fields stay in the order that reads best.
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,svelte}"],
    rules: {
      "perfectionist/sort-interfaces": "off",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-object-types": "off",
    },
  },
  {
    // The order of a parser's keys is the order of its usage line and help.
    files: ["apps/cli/src/bin.ts"],
    rules: {
      "perfectionist/sort-objects": "off",
    },
  },
  {
    rules: {
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
    },
  },
  {
    files: [
      "**/*.test.{js,ts,mjs,mts,cjs,cts}",
      "**/*.spec.{js,ts,mjs,mts,cjs,cts}",
    ],
    rules: {
      "no-console": "off",
    },
  },
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended.map((config) =>
    config.files ? config : { ...config, files: ["**/*.svelte"] },
  ),
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        extraFileExtensions: [".svelte"],
        parser: tseslint.parser,
        projectService: true,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
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
