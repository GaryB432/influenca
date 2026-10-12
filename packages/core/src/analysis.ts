/** Where analyze kept its findings before they moved into the manifest. Read only to bring an old run up to date. */
export const ANALYSIS_FILENAME = ".influenca.analysis.json";

/** What analyze measured about one file. Kept on its manifest entry. */
export type EntryAnalysis = {
  /** Seconds with no sound above the noise floor, for anything with an audio track. */
  silentSec?: number;
  /** Seconds in which the picture did not change, for video. */
  stillSec?: number;
};
