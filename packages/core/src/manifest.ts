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

/** The record of one run: written once by accession, when everything is in, and not edited after. */
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
  height?: number;
  id: string;
  /** "estimated" until ffprobe fills in real numbers. */
  metaSource: "estimated" | "ffprobe";
  outputName: string; // filename in the output dir
  sourceName: string; // filename in the intake dir
  width?: number;
};

/** Shape check for the envelope only; entries are trusted once the version matches. */
export function isManifest(value: unknown): value is Manifest {
  const m = value as null | Partial<Manifest>;
  return typeof m === "object" && m?.version === 1 && Array.isArray(m.entries);
}
