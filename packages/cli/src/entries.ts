import type { ManifestEntry } from "@influenca/core";

import { basename, extname } from "node:path";

export type IntakeFile = { bytes: number; name: string };

/**
 * Files with a convertTo are transcoded; the rest are kept as they arrived. A rewrap
 * changes only the container: the picture and sound inside are carried over untouched.
 */
type KindInfo = {
  convertTo?: string;
  kind: ManifestEntry["kind"];
  rewrap?: true;
};

const KINDS: Record<string, KindInfo> = {
  ".avi": { convertTo: ".mp4", kind: "video" },
  ".jpeg": { kind: "image" },
  ".jpg": { kind: "image" },
  ".mov": { convertTo: ".mp4", kind: "video", rewrap: true },
  ".mp4": { kind: "video" },
  ".wav": { convertTo: ".mp3", kind: "audio" },
};

const ESTIMATED_FPS = 30;
const ESTIMATED_VIDEO_BYTES_PER_SEC = 1_000_000;
const WAV_BYTES_PER_SEC = 176_400; // 16-bit, 44.1 kHz, stereo

export function classify(name: string): KindInfo | undefined {
  return KINDS[extname(name).toLowerCase()];
}

export function outputNameFor(name: string): string {
  const ext = classify(name)?.convertTo;
  return ext ? basename(name, extname(name)) + ext : name;
}

/** Pure: intake listing in, manifest entries out. Throws on output-name collisions. */
export function planEntries(files: IntakeFile[]): ManifestEntry[] {
  const supported = files
    .filter((f) => classify(f.name))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();

  return supported.map((file, i) => {
    const outputName = outputNameFor(file.name);
    const key = outputName.toLowerCase(); // NTFS is case-insensitive
    if (seen.has(key)) {
      throw new Error(`Output name collision: ${outputName}`);
    }
    seen.add(key);

    const base = {
      bytes: file.bytes,
      id: String(i + 1),
      metaSource: "estimated" as const,
      outputName,
      sourceName: file.name,
    };
    const kind = classify(file.name)?.kind;

    if (kind === "image") {
      return { ...base, frameCount: 1 as const, kind };
    }
    if (kind === "audio") {
      return {
        ...base,
        durationSec: round3(file.bytes / WAV_BYTES_PER_SEC),
        kind,
      };
    }
    const durationSec = file.bytes / ESTIMATED_VIDEO_BYTES_PER_SEC;
    return {
      ...base,
      durationSec: round3(durationSec),
      fps: ESTIMATED_FPS,
      frameCount: Math.round(durationSec * ESTIMATED_FPS),
      kind: "video" as const,
    };
  });
}

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The cells that say which file a row is about: its number, the title you gave it on the
 * web page, and its name on disk. The title goes first because it is how you know the
 * file, and its column is only there once something in the run has one.
 */
export function identify(
  entries: ManifestEntry[],
): (e: ManifestEntry) => string[] {
  const titled = entries.some((e) => e.title);
  return (e) => [e.id, ...(titled ? [e.title ?? ""] : []), e.outputName];
}
