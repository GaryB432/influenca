import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    neverBundle: [/^@influenca\/.*/, "some-third-party-package"],
  },
  clean: true,
  entry: ["src/bin.ts"],
  format: ["esm"],
  outDir: "dist",
});
