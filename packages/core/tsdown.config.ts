import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    onlyBundle: ["openai", "undici-types"],
  },
});
