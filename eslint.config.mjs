import js from "@eslint/js"; 
import json from "@eslint/json"; 
import markdown from "@eslint/markdown"; 
import globals from "globals"; 
import tseslint from "typescript-eslint"; 
import importPlugin from "eslint-plugin-import"; 
import perfectionist from "eslint-plugin-perfectionist"; 

export default tseslint.config(
  { 
    ignores: ["**/dist/**", "**/node_modules/**"], 
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: {
      "@eslint/js": js,
    },
    // Safely apply JS, TS, and perfectionist rules only to scripts
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.reduce((acc, config) => ({ ...acc, ...config.rules }), {}),
      ...perfectionist.configs["recommended-alphabetical"].rules,
    },
    languageOptions: {
      globals: { 
        ...globals.browser, 
        ...globals.node, 
      },
    },
  },
  { 
    files: ["**/*.json"], 
    ...json.configs.recommended, 
  }, 
  { 
    files: ["**/*.jsonc"], 
    ...json.configs.recommended, 
    language: "json/jsonc", 
  }, 
  { 
    files: ["**/*.json5"], 
    ...json.configs.recommended, 
    language: "json/json5", 
  }, 
  ...markdown.configs.recommended, 
  { 
    files: ["**/*.md"], 
    language: "markdown/gfm", 
  }, 
  { 
    files: ["packages/core/**/*.ts"], 
    plugins: { 
      import: importPlugin, 
    }, 
    rules: { 
      "import/no-restricted-paths": [ 
        "error", 
        { 
          zones: [ 
            { 
              target: "packages/cli", 
              from: "packages/core", 
              message: "Core must remain independent from the CLI package.", 
            }, 
          ], 
        }, 
      ], 
      "no-restricted-imports": [ 
        "error", 
        { 
          paths: [ 
            { 
              name: "@influenca/cli", 
              message: "Core cannot depend on @influenca/cli.", 
            }, 
            { 
              name: "cac", 
              message: "Core cannot depend on cac; keep CLI parsing concerns in packages/cli.", 
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
              name: "@clack/prompts", 
              message: "Command files must stay UI-agnostic; use @clack/prompts in packages/cli/src/bin.ts.", 
            }, 
          ], 
          patterns: ["@clack/prompts/*"], 
        }, 
      ], 
    }, 
  }
);
