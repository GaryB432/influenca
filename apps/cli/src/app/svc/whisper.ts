import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectedSec, SILENCE_FILTER } from "../measure.js";
import { type OnProgress, runFfmpeg } from "./ffmpeg.js";

export const WHISPER_MODEL = "whisper-1";

/** What Whisper made of one file. */
export type Heard = { language: string; vtt: string; words: number };

type Segment = { end: number; start: number; text: string };

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

// Speech survives mono at 32 kb/s, and at that rate the API's 25 MB upload limit is
// about 100 minutes of sound.
const SPEECH_ARGS = [
  "-vn",
  "-af",
  SILENCE_FILTER,
  "-ac",
  "1",
  "-c:a",
  "libmp3lame",
  "-b:a",
  "32k",
  "-map_metadata",
  "-1",
];

/**
 * The service took the request and turned this file down, e.g. as too long. Any other
 * failure is about the key, the network or the service, and says nothing about the file.
 */
export class RejectedError extends Error {}

/** Pure: the message out of an OpenAI error body, or the body itself if it is not one. */
export function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body.trim();
  } catch {
    return body.trim();
  }
}

/** Pure: Whisper's segments as a WebVTT file. */
export function toVtt(segments: Segment[]): string {
  const cues = segments.map(
    (s) => `${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text.trim()}\n`,
  );
  return ["WEBVTT\n", ...cues].join("\n");
}

/**
 * Sends one kept file's sound to Whisper. Resolves undefined, without sending, for a
 * file with less than a second of sound: Whisper invents words for silence.
 */
export async function transcribe(
  path: string,
  apiKey: string,
  durationSec: number,
  onProgress: OnProgress,
): Promise<Heard | undefined> {
  const scratch = await mkdtemp(join(tmpdir(), "influenca-"));
  try {
    const speech = join(scratch, "speech.mp3");
    // The upload reports nothing, so extraction gets the first half of the bar and the
    // wait for an answer holds it there.
    const log = await runFfmpeg(
      ["-v", "info", "-y", "-i", path, ...SPEECH_ARGS, speech],
      durationSec,
      (fraction) => onProgress(fraction / 2),
    );
    if (durationSec - detectedSec(log, "silence_", durationSec) < 1) return;

    const form = new FormData();
    form.set("file", new Blob([await readFile(speech)]), "speech.mp3");
    form.set("model", WHISPER_MODEL);
    form.set("response_format", "verbose_json"); // the only format that names the language
    const response = await fetch(ENDPOINT, {
      body: form,
      headers: { Authorization: `Bearer ${apiKey}` },
      method: "POST",
    });
    const body = await response.text();
    if (!response.ok) {
      const message = `${errorMessage(body)} (HTTP ${response.status})`;
      throw response.status === 400 || response.status === 413
        ? new RejectedError(message)
        : new Error(`Whisper: ${message}`);
    }

    const heard = JSON.parse(body) as {
      language?: string;
      segments?: Segment[];
      text?: string;
    };
    return {
      language: heard.language ?? "unknown",
      vtt: toVtt(heard.segments ?? []),
      words: (heard.text ?? "").split(/\s+/).filter(Boolean).length,
    };
  } finally {
    await rm(scratch, { force: true, recursive: true });
  }
}

/** 3661.5 -> 01:01:01.500 */
function vttTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}
