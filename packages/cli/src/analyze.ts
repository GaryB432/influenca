import { outro } from "@clack/prompts";
import {
  fs as gbfs,
  type Manifest,
  type Transcription,
  type TranscriptionSegment,
  type VideoStatisticalBlock,
} from "@influenca/core";
import fs from "node:fs";
import path, { join } from "node:path";

import { ASCII_DIM, maybeColorize, summaryTone } from "./color";

export type AnalyzeOptions = {
  inDir: string;
  language: string;
  minimal: boolean;
};

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

export async function runAnalyze(opts: AnalyzeOptions): Promise<void> {
  const result = await runAnalyzeWorkflow({
    inDir: opts.inDir,
    minimal: opts.minimal,
    primaryLanguage: opts.language,
  });
  outro(formatAnalyzeSummary(result, opts.minimal));
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
    const ipl = options.primaryLanguage ? lang === primeLang : true;
    return maybeColorize(ipl ? 2 : ASCII_DIM, "language")
      .concat("  : ")
      .concat(maybeColorize(ipl ? 10 : ASCII_DIM, lang));
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

    console.log(logForVideoId(mp4name, videoStats));

    // console.log(
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
            .map((seg) =>
              maybeColorize(is_language_dim ? ASCII_DIM : 15, seg.text),
            )
            .join("\n");

          console.log(
            languageConsoleLine(
              entry.transcript.meta.language,
              options.primaryLanguage,
            ),
          );

          // console.log(labeledLan);
          console.log(mutedSegments);
        }
      }
    } else {
      console.log(logForNoTranscript());
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
function formatAnalyzeSummary(
  result: AnalyzeWorkflowResult,
  minimal: boolean,
): string {
  const tone = { ...summaryTone };

  if (minimal) {
    return [
      tone.heading("Analyze minimal"),
      `${tone.label("videos:")} ${tone.number(String(result.videoCount))}`,
      `${tone.label("manifest:")} ${tone.path(result.manifestPath)}`,
    ].join("\n");
  }

  const missingStatsCount = result.videoCount - result.withStatsCount;
  const averageDurationSeconds =
    result.withStatsCount > 0
      ? result.totalDurationSeconds / result.withStatsCount
      : 0;
  const averageFrames =
    result.withStatsCount > 0 ? result.totalFrames / result.withStatsCount : 0;

  const rows: Array<[label: string, value: string]> = [
    ["manifest", result.manifestPath],
    ["videos", String(result.videoCount)],
    ["with stats", String(result.withStatsCount)],
    ["missing stats", String(missingStatsCount)],
    ["total duration (s)", result.totalDurationSeconds.toFixed(2)],
    ["total frames", String(result.totalFrames)],
    ["total words", String(result.totalWords)],
    ["avg duration per video (s)", averageDurationSeconds.toFixed(2)],
    ["avg frames per video", averageFrames.toFixed(2)],
  ];
  const labelWidth = rows.reduce(
    (max, [label]) => Math.max(max, label.length),
    0,
  );

  const prettyRows = rows.map(([label, value]) => {
    const paddedLabel = `${label.padEnd(labelWidth)}:`;
    const isPath = label === "manifest";
    const colorizedValue = isPath ? tone.path(value) : tone.number(value);
    return `${tone.label(paddedLabel)} ${colorizedValue}`;
  });

  return [
    tone.heading("Analyze stats"),
    tone.accent("-----------------------------"),
    ...prettyRows,
  ].join("\n");
}

function logForNoTranscript(): string {
  return maybeColorize(ASCII_DIM, "No Transcript");
}

function logForVideoId(
  mp4name: string,
  videoStats: { stats: VideoStatisticalBlock },
) {
  return maybeColorize(10, mp4name)
    .concat("  : ")
    .concat(maybeColorize(10, `${videoStats.stats.duration_seconds}s`));
}
