import { spawnSync } from "node:child_process";
import { platform } from "node:os";

import { resolveWinBinary } from "./resolve-win-binary.mjs";

function run() {
  if (platform() !== "win32") {
    return;
  }

  const binary = resolveWinBinary();
  if (!binary) {
    console.warn("influenca: no Windows adapter binary was found");
    return;
  }

  const result = spawnSync(binary, ["hello"], { stdio: "inherit" });
  if (result.error) {
    console.warn(
      `influenca: Windows adapter check failed: ${result.error.message}`,
    );
  }
}

run();
