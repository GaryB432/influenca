import fs from "node:fs";
import path, { join } from "node:path";

import {
  parseManifest,
  type Transcription,
  type TranscriptionSegment,
} from "../index.js";

export type AnalyzeWorkflowOptions = {
  inDir: string;
  minimal: boolean;
};

export type AnalyzeWorkflowResult = {
  manifestPath: string;
  totalDurationSeconds: number;
  totalFrames: number;
  totalWords: number;
  videoCount: number;
  withStatsCount: number;
};

export function getExtremelyFoundationalSegmentCount(
  vttTranscription: Transcription,
): number | undefined {
  return vttTranscription?.segments?.length;
}

export async function runAnalyzeWorkflow(
  options: AnalyzeWorkflowOptions,
): Promise<AnalyzeWorkflowResult> {
  const manifestPath = path.join(options.inDir, ".influenca.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest found at ${manifestPath}.`);
  }

  const rawManifest = fs.readFileSync(manifestPath, "utf8");
  const manifest = parseManifest(rawManifest);
  const entries = Object.values(manifest);

  let totalDurationSeconds = 0;
  let totalFrames = 0;
  let withStatsCount = 0;
  let totalWords = 0;

  for (const entry of entries) {
    const stats = entry.stats;
    if (!stats) {
      continue;
    }

    if (entry.transcript) {
      const track = fs.readFileSync(
        join(options.inDir, entry.transcript.segments),
        "utf-8",
      );
      const segments = JSON.parse(track) as Array<TranscriptionSegment>;
      const text = segments.map((s) => s.text).join("\n");
      const words = text.split(/\s+/).length;

      totalWords += words;
      console.log(text);
      console.log("---");
    }

    withStatsCount += 1;
    totalDurationSeconds += stats.duration_seconds ?? 0;
    totalFrames += Math.trunc(stats.frames ?? 0);
  }

  return {
    manifestPath,
    totalDurationSeconds,
    totalFrames,
    totalWords,
    videoCount: entries.length,
    withStatsCount,
  };
}
export { type Transcription };
