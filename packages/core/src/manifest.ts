export const MANIFEST_FILENAME = ".influenca.json";

export type AudioEntry = EntryBase & {
  audioCodec?: string;
  channels?: number;
  durationSec: number;
  kind: "audio";
  sampleRate?: number;
};

export type ImageEntry = EntryBase & {
  frameCount: 1;
  kind: "image";
};

/**
 * What a run holds: written by accession, when everything is in. It drives the web page,
 * and what you set there while curating is saved back into its entries.
 */
export type Manifest = {
  createdAt: string; // ISO
  entries: ManifestEntry[];
  version: 1;
};

export type ManifestEntry = AudioEntry | ImageEntry | VideoEntry;

export type Run = { manifest: Manifest; name: string };

export type VideoEntry = EntryBase & {
  durationSec: number;
  fps: number;
  frameCount: number;
  hasAudio?: boolean;
  kind: "video";
  videoCodec?: string;
};

/** What you set about a file on the web page. The rest of an entry is what accession found. */
export type Curation = {
  /** Unwanted. The file itself is still in the run folder. */
  deleted?: boolean;
  /** What you call the file once you have seen what is in it, as you would say it: "Pool b-roll". Its name on disk stays outputName. */
  title?: string;
};

type EntryBase = Curation & {
  bytes: number;
  capturedAt?: string; // ISO; EXIF for images, container creation_time for media
  height?: number;
  id: string;
  /** "estimated" until ffprobe fills in real numbers. */
  metaSource: "estimated" | "ffprobe";
  outputName: string; // filename in the output dir
  sourceName: string; // filename in the intake dir
  width?: number;
};

/**
 * Pure: reads a manifest saved while the title was still called `name`. The old field is
 * taken as the title, and the next save writes it under the new one.
 */
export function withTitles(manifest: Manifest): Manifest {
  for (const entry of manifest.entries as (ManifestEntry & {
    name?: string;
  })[]) {
    if (entry.name !== undefined) entry.title ??= entry.name;
    delete entry.name;
  }
  return manifest;
}

/** Shape check for the envelope only; entries are trusted once the version matches. */
export function isManifest(value: unknown): value is Manifest {
  const m = value as null | Partial<Manifest>;
  return typeof m === "object" && m?.version === 1 && Array.isArray(m.entries);
}
