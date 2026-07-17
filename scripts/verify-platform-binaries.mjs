import { existsSync } from "node:fs";
import { resolve } from "node:path";

const required = [resolve("artifacts/win-x64/influenca-win.exe")];
const missing = required.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error("Missing binaries:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("All required binaries are present.");
}
