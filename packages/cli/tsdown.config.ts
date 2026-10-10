import { defineConfig } from "tsdown";

export default defineConfig({
  deps: { alwaysBundle: [/^@influenca\/core(\/|$)/] },
  entry: ["src/bin.ts"],
  format: "esm",
});
