/** What came of sending one file to be transcribed. Kept on its manifest entry; it cost money to make. */

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
