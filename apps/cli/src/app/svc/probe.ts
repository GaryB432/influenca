import type { ManifestEntry } from "@influenca/core";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { round3 } from "../entries.js";

/** The slice of `ffprobe -of json` output we ask for. Numbers arrive as strings. */
export type ProbeOutput = {
  format?: { duration?: string; tags?: { creation_time?: string } };
  streams?: ProbeStream[];
};

type ProbeStream = {
  avg_frame_rate?: string;
  channels?: number;
  codec_name?: string;
  codec_type?: string;
  height?: number;
  nb_frames?: string;
  sample_rate?: string;
  width?: number;
};

const SHOW_ENTRIES =
  "format=duration:format_tags=creation_time:" +
  "stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,channels,sample_rate";

/** Pure: replaces an entry's estimates with probed facts. Throws if the probe lacks them. */
export function applyProbe(
  entry: ManifestEntry,
  out: ProbeOutput,
): ManifestEntry {
  const video = out.streams?.find((s) => s.codec_type === "video");
  const audio = out.streams?.find((s) => s.codec_type === "audio");
  const durationSec = round3(Number(out.format?.duration));
  const probed = {
    metaSource: "ffprobe" as const,
    ...defined({ capturedAt: isoDate(out.format?.tags?.creation_time) }),
  };

  if (entry.kind === "image") {
    // ffprobe reports a 0x0 stream for a .jpg that holds no picture. // TODO also a png?
    if (!video?.width || !video.height) throw new Error("no image stream");
    return { ...entry, ...probed, height: video.height, width: video.width };
  }
  if (!Number.isFinite(durationSec)) throw new Error("no duration");

  if (entry.kind === "audio") {
    if (!audio) throw new Error("no audio stream");
    return {
      ...entry,
      ...probed,
      durationSec,
      ...defined({
        audioCodec: audio.codec_name,
        channels: audio.channels,
        sampleRate: finite(Number(audio.sample_rate)),
      }),
    };
  }

  const fps = frameRate(video?.avg_frame_rate);
  if (!video || !fps) throw new Error("no video stream");
  return {
    ...entry,
    ...probed,
    durationSec,
    fps,
    // AVI and MP4 count their frames; other containers leave us to derive it.
    frameCount:
      finite(Number(video.nb_frames)) ?? Math.round(durationSec * fps),
    hasAudio: audio !== undefined,
    ...defined({
      height: video.height,
      videoCodec: video.codec_name,
      width: video.width,
    }),
  };
}

export function isFfprobeMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

/** Reads container and stream headers only, so it is quick even for large files. */
export async function probe(path: string): Promise<ProbeOutput> {
  const { stdout } = await promisify(execFile)("ffprobe", [
    "-v",
    "error",
    "-of",
    "json",
    "-show_entries",
    SHOW_ENTRIES,
    path,
  ]);
  return JSON.parse(stdout) as ProbeOutput;
}

function defined<T extends object>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

const finite = (n: number) => (Number.isFinite(n) ? n : undefined);

/** "30000/1001" -> 29.97; ffprobe reports "0/0" when it does not know. */
function frameRate(ratio = ""): number | undefined {
  const [num, den] = ratio.split("/").map(Number);
  const fps = (num ?? Number.NaN) / (den ?? 1);
  return Number.isFinite(fps) && fps > 0 ? round3(fps) : undefined;
}

function isoDate(value?: string): string | undefined {
  const time = Date.parse(value ?? "");
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}
