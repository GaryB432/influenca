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
 * The record of one run: written once by accession, when everything is in. Its entries
 * are not edited after, except for what you decide about a file on the web page:
 * `deleted` and `name`.
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

type EntryBase = {
  bytes: number;
  capturedAt?: string; // ISO; EXIF for images, container creation_time for media
  /** Marked as unwanted on the web page. The file itself is still in the run folder. */
  deleted?: boolean;
  height?: number;
  id: string;
  /** "estimated" until ffprobe fills in real numbers. */
  metaSource: "estimated" | "ffprobe";
  /** What you call the file once you have seen what is in it: "mary-eating". Its name on disk stays outputName. */
  name?: string;
  outputName: string; // filename in the output dir
  sourceName: string; // filename in the intake dir
  width?: number;
};

/** Shape check for the envelope only; entries are trusted once the version matches. */
export function isManifest(value: unknown): value is Manifest {
  const m = value as null | Partial<Manifest>;
  return typeof m === "object" && m?.version === 1 && Array.isArray(m.entries);
}
