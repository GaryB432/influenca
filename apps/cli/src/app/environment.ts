import { existsSync } from "node:fs";
import path from "node:path";

export function setupEnvironment() {
  const DOT_ENV = ".env";
  const envFilePath = path.join(process.cwd(), DOT_ENV);
  if (existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}

export const webAppOrigin = "http://localhost:5173";

export const corpusRoot = process.env.INFLUENCA_MEDIA_DIR;
