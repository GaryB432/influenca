export * as color from "./color.js";
export * from "./motion.js";
export * from "./names.js";

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

export type Manifest = Record<string, Partial<VideoEntry>>;

export type VideoEntry = {
  stats: Partial<VideoStatisticalBlock>;
  transcript: string[];
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
