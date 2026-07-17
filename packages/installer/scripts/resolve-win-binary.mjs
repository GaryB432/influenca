import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveWinBinary() {
  const candidate = resolve(
    __dirname,
    "../../../artifacts/win-x64/influenca-win.exe",
  );
  return existsSync(candidate) ? candidate : null;
}
