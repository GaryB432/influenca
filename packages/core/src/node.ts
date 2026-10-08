// Everything in core that touches the filesystem. The main entry stays free of Node
// built-ins so the web app's browser code can import it.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { readJSON } from "./json.js";
import {
  isManifest,
  type Manifest,
  MANIFEST_FILENAME,
  type Run,
} from "./manifest.js";

export { readJSON } from "./json.js";

/** Every folder directly under root that holds a readable manifest, newest name first. */
export async function listRuns(root: string): Promise<Run[]> {
  const dirs = (await readdir(root, { withFileTypes: true })).filter((d) =>
    d.isDirectory(),
  );
  const found = await Promise.all(
    dirs.map(async ({ name }) => ({
      // Unreadable here means not a run, e.g. a folder written by an older influenca.
      manifest: await readManifest(join(root, name)).catch(() => undefined),
      name,
    })),
  );
  return found
    .filter((r): r is Run => r.manifest !== undefined)
    .toSorted((a, b) => (a.name < b.name ? 1 : -1));
}

/** Reads a run folder's manifest, rejecting files this version cannot read. */
export async function readManifest(dir: string): Promise<Manifest> {
  const path = join(dir, MANIFEST_FILENAME);
  const manifest = await readJSON<unknown>(path);
  if (!isManifest(manifest)) {
    throw new Error(
      `${path} is not a version 1 manifest (written by an older influenca?)`,
    );
  }
  return manifest;
}
