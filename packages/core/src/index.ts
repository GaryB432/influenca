export * from "./time/index.js";

export type EncodingStats = {
  bitrate: string;
  fps: number;
  frames: number;
  total_size: number;
};

export type FrameSamples = {
  frames: FrameStats[];
  sample_interval_seconds: number;
};

export type FrameStats = {
  checksum: string;
  mean: number[];
  pts_time: number;
  stdev: number[];
};

export type Manifest = Record<string, VideoEntry>;

export type VideoEntry = {
  "encoding-stats": EncodingStats;
  "frame-samples"?: FrameSamples;
};
