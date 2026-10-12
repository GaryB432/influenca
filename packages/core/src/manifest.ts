import type { EntryAnalysis } from "./analysis.js";
import type { Transcript } from "./transcripts.js";

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
 * Everything known about a run, in one file. Accession writes it when the files are in;
 * transcribe and analyze add what they find to its entries, and the web page adds what
 * you set there while curating.
 */
export type Manifest = {
  /** When analyze last measured the run. Absent until it has. */
  analyzedAt?: string; // ISO
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

/** What the tools worked out about a file once it was kept. */
export type Findings = {
  analysis?: EntryAnalysis;
  transcript?: Transcript;
};

type EntryBase = Curation &
  Findings & {
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
 * Shape check for the envelope only; entries are trusted once the version and array match.
 */
export function isManifest(value: unknown): value is Manifest {
  const m = value as null | Partial<{ entries: unknown; version: unknown }>;
  return (
    typeof m === "object" &&
    m?.version === 1 &&
    Array.isArray(m.entries)
  );
}
