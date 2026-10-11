import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Loads settings from each file that exists. A variable that is already set is never
 * overwritten, so the environment wins, then the earliest file here to name it.
 */
export function loadEnv(...files: string[]): void {
  for (const file of files) {
    try {
      process.loadEnvFile(file);
    } catch {
      // not there, fine
    }
  }
}

/** The per-user settings file, in the XDG config directory: what makes the CLI work from any folder. */
export function userEnvFile(env: NodeJS.ProcessEnv = process.env): string {
  return join(
    env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "influenca",
    ".env",
  );
}
