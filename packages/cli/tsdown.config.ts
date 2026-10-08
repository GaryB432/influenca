import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  entry: ["src/bin.ts"],
  format: ["esm"],
  outDir: "dist",
});
