import { MANIFEST_FILENAME } from "@influenca/core";
import { listRuns, userEnvFile } from "@influenca/core/node";
import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Where a missing setting can go: the places bin.ts reads, nearest first. */
export const howToSet = (name: string) =>
  `Set ${name} in the environment, in .env in this folder, or in ${userEnvFile()}`;

export async function latestRun(root: string): Promise<string> {
  if (await hasManifest(root)) return root; // a --no-timestamp run
  const [newest] = await listRuns(root);
  if (newest) return join(root, newest.name);
  throw new Error(`No readable ${MANIFEST_FILENAME} found under ${root}`);
}

export function mediaDir(): string {
  const dir = process.env.INFLUENCA_MEDIA_DIR;
  if (!dir) {
    throw new Error(`${howToSet("INFLUENCA_MEDIA_DIR")}, or pass --out-dir.`);
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
