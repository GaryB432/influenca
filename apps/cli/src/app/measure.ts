import type { EntryAnalysis } from "@influenca/core";

import { round3 } from "./entries.js";
import { type OnProgress, runFfmpeg } from "./svc/ffmpeg.js";

// Shrinking each frame to a thumbnail averages sensor noise away, so only real movement
// counts as change. Five frames a second is plenty to tell a parked scene from a busy one.
const STILL_FILTER = "scale=64:-2:flags=area,fps=5,freezedetect=n=0.01:d=2";
export const SILENCE_FILTER = "silencedetect=n=-40dB:d=1";

/** Pure: totals a detector's stretches from ffmpeg's log. One still open at the end runs to the end. */
export function detectedSec(
  log: string,
  prefix: "freeze_" | "silence_",
  durationSec: number,
): number {
  let total = 0;
  let open: number | undefined;
  for (const [, key, value] of log.matchAll(
    new RegExp(`${prefix}(start|duration): (-?[\\d.]+)`, "g"),
  )) {
    if (key === "start") open = Number(value);
    else {
      total += Number(value);
      open = undefined;
    }
  }
  if (open !== undefined) total += Math.max(0, durationSec - open);
  return round3(Math.min(total, durationSec));
}

/** Decodes one kept file and times its still and silent stretches. */
export async function measure(
  path: string,
  has: { audio: boolean; video: boolean },
  durationSec: number,
  onProgress: OnProgress,
): Promise<EntryAnalysis> {
  const log = await runFfmpeg(
    [
      "-v",
      "info",
      "-i",
      path,
      ...(has.video ? ["-vf", STILL_FILTER] : ["-vn"]),
      ...(has.audio ? ["-af", SILENCE_FILTER] : ["-an"]),
      "-f",
      "null",
      "-",
    ],
    durationSec,
    onProgress,
  );
  return {
    ...(has.audio && { silentSec: detectedSec(log, "silence_", durationSec) }),
    ...(has.video && { stillSec: detectedSec(log, "freeze_", durationSec) }),
  };
}
