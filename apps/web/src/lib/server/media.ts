import { loadEnv, userEnvFile } from "@influenca/core/node";
import { resolve, sep } from "node:path";

// The same settings the CLI reads: the repo-root .env, from wherever the server was
// started, then the per-user file. Server-only: lives under lib/server.
loadEnv(".env", "../../.env", userEnvFile());

export function mediaRoot(): string {
  const dir = process.env.INFLUENCA_MEDIA_DIR;
  if (!dir) throw new Error("INFLUENCA_MEDIA_DIR is not set");
  return resolve(dir);
}

/** Resolve a route param inside the media root, or return undefined if it escapes. */
export function resolveInsideRoot(
  root: string,
  param: string,
): string | undefined {
  const dir = resolve(root, param);
  return dir === root || dir.startsWith(root + sep) ? dir : undefined;
}

/** /mnt/e/clips/a.mp4 -> E:\clips\a.mp4, for a WSL path that Explorer can open. Otherwise undefined. */
export function windowsPath(path: string): string | undefined {
  const [, drive, rest] = /^\/mnt\/([a-z])\/(.*)$/.exec(path) ?? [];
  return drive && rest !== undefined
    ? `${drive.toUpperCase()}:\\${rest.replaceAll("/", "\\")}`
    : undefined;
}
