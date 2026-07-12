import { existsSync } from "node:fs";
import path from "node:path";

export function setupEnvironment() {
  const DOT_ENV = ".env";
  const envFilePath = path.join(process.cwd(), DOT_ENV);
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}
