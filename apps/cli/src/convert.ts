import { basename } from "node:path";

import { type OnProgress, runFfmpeg } from "./ffmpeg.js";

// The converted file is the only copy we keep, so these lean towards quality over size.
const VIDEO_ARGS = [
  "-c:v",
  "libx264",
  "-crf",
  "18",
  "-preset",
  "medium",
  "-vf",
  "pad=ceil(iw/2)*2:ceil(ih/2)*2", // H.264 needs even dimensions
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-movflags",
  "+faststart", // playable in a browser before it has fully loaded
];
const AUDIO_ARGS = ["-c:a", "libmp3lame", "-q:a", "2"];
// Nothing is decoded, so nothing is lost and it runs at the speed of a copy.
const REWRAP_ARGS = ["-c", "copy", "-movflags", "+faststart"];

/**
 * Transcodes src into dest, whose extension picks the container. Overwrites dest.
 * A rewrap moves the streams across as they are instead of encoding them again.
 */
export async function convert(
  src: string,
  dest: string,
  kind: "audio" | "video",
  durationSec: number,
  onProgress: OnProgress,
  rewrap = false,
): Promise<void> {
  const codec = rewrap
    ? REWRAP_ARGS
    : kind === "video"
      ? VIDEO_ARGS
      : AUDIO_ARGS;
  const args = [
    "-v",
    "error",
    "-y",
    "-i",
    src,
    "-map_metadata",
    "0",
    ...codec,
    dest,
  ];
  try {
    await runFfmpeg(args, durationSec, onProgress);
  } catch (error) {
    throw new Error(
      `ffmpeg failed on ${basename(src)}: ${(error as Error).message}`,
      {
        cause: error,
      },
    );
  }
}
