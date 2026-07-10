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
  
  // 1. Core JavaScript base rules (Scoped safely to code files)
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: { 
        ...globals.browser, 
        ...globals.node, 
      },
    },
  },

  // 2. TypeScript Recommended Rules (Scoped safely to TS/JS code files)
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ["**/*.{ts,mts,cts,tsx,js,mjs,cjs,jsx}"],
  })),

  // 3. Perfectionist Sorting Rules (FIX: Scoped safely to code files only)
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    ...perfectionist.configs["recommended-alphabetical"],
  },

  // 4. JSON configurations (Using dedicated @eslint/json parsers)
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

  // 5. Markdown configurations (Safely scoped)
  ...markdown.configs.recommended.map(config => ({
    ...config,
    files: config.files || ["**/*.md"]
  })), 
  { 
    files: ["**/*.md"], 
    language: "markdown/gfm", 
  }, 

  // 6. Custom Monorepo Architecture Rules
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
