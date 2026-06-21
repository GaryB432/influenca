import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    extends: ["js/recommended"],
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: { globals: globals.browser },
    plugins: { js },
  },
  tseslint.configs.recommended,
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
  { ignores: ["**/dist"] },
]);
