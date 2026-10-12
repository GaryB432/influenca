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
  version: 2;
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

/**
 * The two files a version 1 run kept beside its manifest, one written by analyze and one
 * by transcribe, each keyed by entry id.
 */
export type Sidecars = {
  analysis?: { createdAt: string; entries: Record<string, EntryAnalysis> };
  transcripts?: { entries: Record<string, Transcript> };
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
 * Pure: brings a manifest that was saved by an earlier influenca up to this one. A title
 * that was still called `name` becomes `title`, and what a version 1 run kept in the two
 * files beside it is put on the entries. Nothing already on an entry is replaced. The
 * next save writes it all in the new form; the old files are then read no more.
 */
export function upgrade(read: Manifest, old: Sidecars = {}): Manifest {
  const manifest = read as Omit<Manifest, "version"> & { version: 1 | 2 };
  const wasApart = manifest.version === 1;
  for (const entry of manifest.entries as (ManifestEntry & {
    name?: string;
  })[]) {
    if (entry.name !== undefined) entry.title ??= entry.name;
    delete entry.name;
    if (!wasApart) continue;
    const analysis = old.analysis?.entries[entry.id];
    const transcript = old.transcripts?.entries[entry.id];
    if (analysis) entry.analysis ??= analysis;
    if (transcript) entry.transcript ??= transcript;
  }
  if (wasApart && old.analysis) manifest.analyzedAt ??= old.analysis.createdAt;
  manifest.version = 2;
  return manifest as Manifest;
}

/**
 * Shape check for the envelope only; entries are trusted once the version is one this
 * influenca reads. A version 1 file passes, and `upgrade` then brings it up to date.
 */
export function isManifest(value: unknown): value is Manifest {
  const m = value as null | Partial<{ entries: unknown; version: unknown }>;
  return (
    typeof m === "object" &&
    (m?.version === 1 || m?.version === 2) &&
    Array.isArray(m.entries)
  );
}
