import fs from "node:fs";
import path, { join } from "node:path";

import {
  parseManifest,
  type Transcription,
  type TranscriptionSegment,
  type VideoEntry,
} from "../index.js";
import * as gbfs from "../shims/fs.js";

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
    const e: VideoEntry = {
      transcript: undefined,
      video: { adsf: { stats: {} } },
    };

    if (!e.video) {
      continue;
    }

    const statsBlock = Object.values(e.video).at(0);

    if (!statsBlock || !statsBlock.stats) {
      continue;
    }

    if (entry.transcript) {
      const segments = gbfs.readJSONSync<Array<TranscriptionSegment>>(
        join(options.inDir, entry.transcript.segments),
      );
      const text = segments.map((s) => s.text).join("\n");
      const words = text.split(/\s+/).length;

      totalWords += words;
      console.log(text);
      console.log("---");
    }

    withStatsCount += 1;
    totalDurationSeconds += statsBlock.stats.duration_seconds ?? 0;
    totalFrames += Math.trunc(statsBlock.stats.frames ?? 0);
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
