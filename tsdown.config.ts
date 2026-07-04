import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/cli.ts",
    platform: "node",
  },
  {
    entry: "src/index.ts",
    platform: "node",
  },
]);
