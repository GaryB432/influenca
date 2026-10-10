export const TRANSCRIPTS_FILENAME = ".influenca.transcripts.json";

export type Transcript =
  | {
      /** As Whisper names it: "english", not "en". */
      language: string;
      model: string;
      status: "done";
      vttName: string;
      words: number;
    }
  /** Whisper turned the file down. Not sent again unless asked. */
  | { model: string; reason: string; status: "failed" }
  /** Too little sound to send. */
  | { status: "silent" };

/**
 * What transcribe has had written down for a run. Sits beside the manifest and is
 * written only by transcribe. Unlike the analysis it cost money to make.
 */
export type Transcripts = {
  createdAt: string; // ISO
  /** Keyed by the manifest entry's id. */
  entries: Record<string, Transcript>;
  version: 1;
};

/** Pure: what a .vtt says, with the header and cue timings taken out. */
export function vttText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) => line && !line.startsWith("WEBVTT") && !line.includes("-->"),
    )
    .join(" ");
}
