import { console_wrapper as coolsole } from "@influenca/shared";
import fs from "node:fs";
import path, { join } from "node:path";

import { color256 } from "../color";
import {
  type Manifest,
  type Transcription,
  type TranscriptionSegment,
  type VideoStatisticalBlock,
} from "../index";
import * as gbfs from "../shims/fs";

export type AnalyzeWorkflowOptions = {
  inDir: string;
  minimal: boolean;
  primaryLanguage: string | undefined;
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

  const manifest = gbfs.readJSONSync<Manifest>(manifestPath, "utf-8");
  const manifest_keys = Object.keys(manifest);

  let totalDurationSeconds = 0;
  let totalFrames = 0;
  let withStatsCount = 0;
  let totalWords = 0;

  function languageConsoleLine(
    lang: string,
    primeLang: string | undefined,
  ): string {
    const ipl = Boolean(options.primaryLanguage) ? lang === primeLang : true;
    return color256(ipl ? 2 : 241, "language")
      .concat("  : ")
      .concat(color256(ipl ? 10 : 241, lang));
  }

  for (const manifest_key of manifest_keys) {
    const entry = manifest[manifest_key];
    if (!entry) {
      continue;
    }

    const [mp4name] = Object.keys(entry.video);

    if (!mp4name) {
      throw new Error("tbd");
    }
    const videoStats = entry.video[mp4name]!;

    coolsole.log(logForVideoId(mp4name, videoStats));

    // coolsole.log(
    //   `${summaryTone.label(mp4name)}: ${summaryTone.number(JSON.stringify(videoStats))}`,
    // );

    if (entry.transcript && entry.transcript.meta.language) {
      if (entry.transcript.segments) {
        const segments = gbfs.readJSONSync<Array<TranscriptionSegment>>(
          join(options.inDir, entry.transcript.segments),
        );
        const text = segments.map((s) => s.text).join("\n");
        const words = text.split(/\s+/).length;
        totalWords += words;

        if (!options.minimal) {
          const is_language_dim = options.primaryLanguage
            ? entry.transcript.meta.language !== options.primaryLanguage
            : false;

          const mutedSegments = segments
            .map((seg) => color256(is_language_dim ? 241 : 15, seg.text))
            .join("\n");

          console.log(
            languageConsoleLine(
              entry.transcript.meta.language,
              options.primaryLanguage,
            ),
          );

          // coolsole.log(labeledLan);
          coolsole.log(mutedSegments);
        }
      }
    } else {
      coolsole.log(logForNoTranscript());
    }

    withStatsCount += 1;
    totalFrames += videoStats.stats.frames;
    totalDurationSeconds += videoStats.stats.duration_seconds;
  }

  return {
    manifestPath,
    totalDurationSeconds,
    totalFrames,
    totalWords,
    videoCount: manifest_keys.length,
    withStatsCount,
  };
}
function logForNoTranscript(): string {
  return color256(241, "No Transcript");
}

function logForVideoId(
  mp4name: string,
  videoStats: { stats: VideoStatisticalBlock },
) {
  return color256(10, mp4name)
    .concat("  : ")
    .concat(color256(10, `${videoStats.stats.duration_seconds}s`));
}
