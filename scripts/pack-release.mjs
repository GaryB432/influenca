import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["--filter", "@influenca/cli", "pack"], {
  shell: true,
  stdio: "inherit",
});

process.exitCode = result.status ?? 1;
