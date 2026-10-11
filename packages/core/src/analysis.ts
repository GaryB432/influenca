export const ANALYSIS_FILENAME = ".influenca.analysis.json";

/**
 * What analyze has worked out about a run. Sits beside the manifest, is written
 * only by analyze, and can be deleted and redone without touching the manifest.
 */
export type Analysis = {
  createdAt: string; // ISO
  /** Keyed by the manifest entry's id. */
  entries: Record<string, EntryAnalysis>;
  version: 1;
};

export type EntryAnalysis = {
  /** Seconds with no sound above the noise floor, for anything with an audio track. */
  silentSec?: number;
  /** Seconds in which the picture did not change, for video. */
  stillSec?: number;
};
