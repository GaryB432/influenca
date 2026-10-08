import {
  formatDuration,
  type ManifestEntry,
  summarize,
} from "@influenca/core";
import { readManifest } from "@influenca/core/node";
import { resolve } from "node:path";

import { latestRun, mediaDir } from "./paths.js";
import { accent, dim } from "./theme.js";

export type AnalyzeOptions = {
  inDir?: string;
  /** Parsed but unused now that accession no longer transcribes. */
  language: string;
  /** Totals only, without the line per file. */
  minimal: boolean;
};

export async function runAnalyze(opts: AnalyzeOptions): Promise<void> {
  const dir = opts.inDir ? resolve(opts.inDir) : await latestRun(mediaDir());
  const manifest = await readManifest(dir);
  const s = summarize(manifest);

  console.log(accent(dir));
  console.log(
    `Videos: ${s.counts.video}  Audio: ${s.counts.audio}  Images: ${s.counts.image}`,
  );
  console.log(`Total frames: ${s.totalFrames}`);
  if (opts.minimal) return;
  console.log(`Total duration: ${formatDuration(s.totalDurationSec)}`);

  for (const e of manifest.entries) {
    console.log(`  ${[e.outputName, e.kind, ...details(e)].join("  ")}`);
  }
  if (s.estimated) {
    console.log(
      dim(
        "Note: files that could not be probed show estimated frames and durations.",
      ),
    );
  }
}

function details(e: ManifestEntry): string[] {
  if (e.kind === "image") return ["1 frame"];
  return [
    e.kind === "video"
      ? `${e.frameCount} frames`
      : formatDuration(e.durationSec),
  ];
}
