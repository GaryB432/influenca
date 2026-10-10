import type { Manifest } from "./manifest.js";

export type Summary = {
  counts: { audio: number; image: number; video: number };
  estimated: boolean;
  totalDurationSec: number;
  totalFrames: number;
};

export function formatDuration(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
}

export function summarize(manifest: Manifest): Summary {
  const summary: Summary = {
    counts: { audio: 0, image: 0, video: 0 },
    estimated: manifest.entries.some((e) => e.metaSource === "estimated"),
    totalDurationSec: 0,
    totalFrames: 0,
  };
  for (const e of manifest.entries) {
    summary.counts[e.kind]++;
    if (e.kind !== "image") summary.totalDurationSec += e.durationSec;
    if (e.kind !== "audio") summary.totalFrames += e.frameCount;
  }
  return summary;
}
