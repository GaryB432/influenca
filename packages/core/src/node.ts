// Everything in core that touches the filesystem. The main entry stays free of Node
// built-ins so the web app's browser code can import it.
import { readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { type Analysis, ANALYSIS_FILENAME } from "./analysis.js";
import { readJSON } from "./json.js";
import {
  type Curation,
  isManifest,
  type Manifest,
  MANIFEST_FILENAME,
  type Run,
  withTitles,
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
  return withTitles(manifest);
}

/**
 * Saves what you have set about one entry, and resolves with the manifest as it now
 * stands. Only what is given changes. A blank title or a mark that is off is left out of
 * the file rather than stored. No file on disk is renamed or removed.
 */
export async function updateEntry(
  dir: string,
  id: string,
  changes: Curation,
): Promise<Manifest> {
  const manifest = await readManifest(dir);
  const path = join(dir, MANIFEST_FILENAME);
  const entry = manifest.entries.find((e) => e.id === id);
  if (!entry) throw new Error(`No entry ${id} in ${path}`);

  if (changes.deleted === true) entry.deleted = true;
  else if (changes.deleted === false) delete entry.deleted;
  if (changes.title?.trim()) entry.title = changes.title.trim();
  else if (changes.title !== undefined) delete entry.title;

  // Written beside, then renamed, so a save that is cut short never leaves half a manifest.
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
