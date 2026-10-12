/** What analyze measured about one file. Kept on its manifest entry. */
export type EntryAnalysis = {
  /** Seconds with no sound above the noise floor, for anything with an audio track. */
  silentSec?: number;
  /** Seconds in which the picture did not change, for video. */
  stillSec?: number;
};
