// Everything in core that touches the filesystem. The main entry stays free of Node
// built-ins so the web app's browser code can import it.
import { readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type Analysis, ANALYSIS_FILENAME } from "./analysis.js";
import { readJSON } from "./json.js";
import {
  isManifest,
  type Manifest,
  MANIFEST_FILENAME,
  type ManifestEntry,
  type Run,
} from "./manifest.js";
import { type Transcripts, TRANSCRIPTS_FILENAME } from "./transcripts.js";

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

/** A run's analysis, or undefined if there is none yet or it is not one this version wrote. */
export async function readAnalysis(dir: string): Promise<Analysis | undefined> {
  const a = await readJSON<null | Partial<Analysis>>(
    join(dir, ANALYSIS_FILENAME),
  ).catch(() => null);
  return a?.version === 1 && typeof a.entries === "object"
    ? (a as Analysis)
    : undefined;
}

/** Reads a run folder's manifest, rejecting files this version cannot read. */
export async function readManifest(dir: string): Promise<Manifest> {
  const path = join(dir, MANIFEST_FILENAME);
  const manifest = await readJSON<unknown>(path).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error(
      `No ${MANIFEST_FILENAME} in ${dir}; it is not a run folder.`,
      {
        cause: error,
      },
    );
  });
  if (!isManifest(manifest)) {
    throw new Error(
      `${path} is not a version 1 manifest (written by an older influenca?)`,
    );
  }
  return manifest;
}

/** Marks one entry as deleted, or takes the mark off. No file is removed. */
export function setDeleted(
  dir: string,
  id: string,
  deleted: boolean,
): Promise<Manifest> {
  return decide(dir, id, (entry) => {
    if (deleted) entry.deleted = true;
    else delete entry.deleted; // absent, not false, so an untouched manifest and a restored one match
  });
}

/** Gives one entry the name you know it by, or takes the name off when it is blank. No file is renamed. */
export function setName(
  dir: string,
  id: string,
  name: string,
): Promise<Manifest> {
  return decide(dir, id, (entry) => {
    if (name.trim()) entry.name = name.trim();
    else delete entry.name;
  });
}

/**
 * Records something you have decided about one entry, and resolves with the manifest as
 * it now stands. This is the only way a manifest changes once accession has written it.
 * What accession recorded is not for changing here: only `deleted` and `name` are.
 */
async function decide(
  dir: string,
  id: string,
  change: (entry: Pick<ManifestEntry, "deleted" | "name">) => void,
): Promise<Manifest> {
  const manifest = await readManifest(dir);
  const path = join(dir, MANIFEST_FILENAME);
  const entry = manifest.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`No entry ${id} in ${path}`);
  change(entry);
  // Written beside, then renamed: this is the one file a run cannot have rebuilt.
  await writeFile(`${path}.tmp`, JSON.stringify(manifest, null, 2));
  await rename(`${path}.tmp`, path);
  return manifest;
}

/** A run's transcripts record, or undefined if there is none yet or it is not one this version wrote. */
export async function readTranscripts(
  dir: string,
): Promise<Transcripts | undefined> {
  const t = await readJSON<null | Partial<Transcripts>>(
    join(dir, TRANSCRIPTS_FILENAME),
  ).catch(() => null);
  return t?.version === 1 && typeof t.entries === "object"
    ? (t as Transcripts)
    : undefined;
}
