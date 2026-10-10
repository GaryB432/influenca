import { MANIFEST_FILENAME } from "@influenca/core";
import { listRuns } from "@influenca/core/node";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function latestRun(root: string): Promise<string> {
  if (await hasManifest(root)) return root; // a --no-timestamp run
  const [newest] = await listRuns(root);
  if (newest) return join(root, newest.name);
  throw new Error(`No readable ${MANIFEST_FILENAME} found under ${root}`);
}

export function mediaDir(): string {
  const dir = process.env.INFLUENCA_MEDIA_DIR;
  if (!dir) {
    throw new Error("Set INFLUENCA_MEDIA_DIR in .env (or pass --out-dir).");
  }
  return resolve(dir);
}

/** 2059-05-20T00-00-00Z: ISO-shaped, NTFS-safe, sorts chronologically. */
export function stamp(date = new Date()): string {
  return date
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replaceAll(":", "-");
}

export const hasManifest = (dir: string) =>
  stat(join(dir, MANIFEST_FILENAME)).then(
    () => true,
    () => false,
  );
