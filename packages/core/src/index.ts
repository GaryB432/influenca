export * as color from "./color.js";
export * from "./motion.js";
export * from "./names.js";
export * as fs from "./shims/fs.js";
export * from "./utils/meter.js";
export * from "./workflows/accession.js";
export * from "./workflows/analyze.js";

import OpenAI from "openai";

// export type EncodingStats = {
//   bitrate: string;
//   fps: number;
//   frames: number;
//   total_size: number;
// };

// export type FrameSamples = {
//   frames: FrameStats[];
//   sample_interval_seconds: number;
// };

// export type FrameStats = {
//   checksum: string;
//   mean: number[];
//   pts_time: number;
//   stdev: number[];
// };

export type AbbreviatedTranscriptionMetadata = Omit<
  Transcription,
  "segments" | "text"
>;

export type Manifest = Record<string, Partial<VideoEntry>>;
export type Transcription = OpenAI.Audio.TranscriptionVerbose;

export type TranscriptionSegment = OpenAI.Audio.TranscriptionSegment;

export type VideoEntry = {
  stats: Partial<VideoStatisticalBlock>;
  transcript:
    | {
        meta: AbbreviatedTranscriptionMetadata;

        segments: string;
      }
    | undefined;
};

type VideoStatisticalBlock = {
  arbitraryFutureMetric: string;
  duration_seconds: number;
  frames: number;
  interestScore: number;
};

export function parseManifest(rawManifest: string): Manifest {
  // TODO validate with a proper json schema 7
  return JSON.parse(rawManifest) as Manifest;
}
