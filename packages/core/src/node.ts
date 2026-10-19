import type { Abortable } from "node:events";
import type { Mode, ObjectEncodingOptions, OpenMode, PathLike } from "node:fs";

// Everything in core that touches the filesystem. The main entry stays free of Node
// built-ins so the web app's browser code can import it.
import {
  access,
  type FileHandle,
  writeFile as fswf,
  readdir,
  rename,
} from "node:fs/promises";
import { join } from "node:path";

import { readJSON } from "./json.js";
import {
  type Curation,
  type Findings,
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

/** Reads a run folder's manifest, rejecting unsupported versions or missing entries. */
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
      `${path} is not a version 1 manifest with an entries array.`,
    );
  }
  return manifest;
}

/**
 * Saves what has changed about one entry, and resolves with the manifest as it now
 * stands. Only what is given changes. A blank title or a mark that is off is left out of
 * the file rather than stored. No file on disk is renamed or removed.
 */
export function updateEntry(
  dir: string,
  id: string,
  changes: Curation & Findings,
): Promise<Manifest> {
  return updateManifest(dir, (manifest) => {
    const entry = manifest.entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error(`No entry ${id} in ${join(dir, MANIFEST_FILENAME)}`);
    }
    if (changes.deleted === true) entry.deleted = true;
    else if (changes.deleted === false) delete entry.deleted;
    if (changes.title?.trim()) entry.title = changes.title.trim();
    else if (changes.title !== undefined) delete entry.title;
    if (changes.tags !== undefined) {
      const tags = changes.tags.map((tag) => tag.trim()).filter(Boolean);
      if (tags.length > 0) entry.tags = [...new Set(tags)];
      else delete entry.tags;
    }
    if (changes.analysis) entry.analysis = changes.analysis;
    if (changes.transcript) entry.transcript = changes.transcript;
  });
}

/**
 * The one way a manifest is saved once accession has written it. The file is read afresh,
 * changed and written back whole, so the web page, transcribe and analyze can each be
 * saving to the same run: none of them writes from a copy it has been holding. Two saves
 * landing within the same few milliseconds could still cross, which is a risk taken for
 * a tool one person runs.
 */
export async function updateManifest(
  dir: string,
  change: (manifest: Manifest) => void,
): Promise<Manifest> {
  const manifest = await readManifest(dir);
  change(manifest);
  const path = join(dir, MANIFEST_FILENAME);
  // Written beside, under a name of this process's own, then renamed: a save that is cut
  // short never leaves half a manifest, and two savers never share a half-written file.
  const part = `${path}.${process.pid}.tmp`;
  await fswf(part, JSON.stringify(manifest, null, 2));
  await rename(part, path);
  return manifest;
}

export const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export function writeFile(
  file: FileHandle | PathLike,
  data:
    | AsyncIterable<NodeJS.ArrayBufferView | string>
    | Iterable<NodeJS.ArrayBufferView | string>
    | NodeJS.ArrayBufferView
    | string,
  options?:
    | (Abortable &
        ObjectEncodingOptions & {
          flag?: OpenMode | undefined;
          flush?: boolean | undefined;
          mode?: Mode | undefined;
        })
    | BufferEncoding
    | null,
): Promise<void> {
  if (options) {
    console.warn(file.toString());
    if (data) {
      console.warn(data);
      return Promise.resolve();
    }
    return Promise.reject("nothing to write");
  }
  return Promise.reject("not a thing");
}
