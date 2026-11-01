import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

import { detectedSec, SILENCE_FILTER } from "../utils/measure.js";
import { type OnProgress, runFfmpeg } from "./ffmpeg.js";

export const WHISPER_MODEL = "whisper-1";

/** What Whisper made of one file. */
export type Heard = { language: string; vtt: string; words: number };

export type TranscribeOptions = {
  durationSec: number;
  onProgress: OnProgress;
};

export interface Transcriber {
  transcribe(path: string, options: TranscribeOptions): Promise<Heard | undefined>;
}

export type TranscriberSelection = {
  model: string;
  name: "local" | "openai";
  transcriber: Transcriber;
};

type Segment = { end: number; start: number; text: string };

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const SPEECH_ARGS = [
  "-vn",
  "-af",
  SILENCE_FILTER,
  "-ac",
  "1",
  "-ar",
  "16000",
  "-c:a",
  "pcm_s16le",
  "-f",
  "wav",
  "-map_metadata",
  "-1",
];

const execFileAsync = promisify(execFile);

/**
 * The service took the request and turned this file down, e.g. as too long. Any other
 * failure is about the key, the network or the service, and says nothing about the file.
 */
export class RejectedError extends Error {}

/** Selects a backend explicitly; local mode never silently uploads audio to OpenAI. */
export function createTranscriber(
  requested?: string,
  env: NodeJS.ProcessEnv = process.env,
): TranscriberSelection {
  const name = requested ?? env.INFLUENCA_TRANSCRIBER ?? "openai";
  if (name === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Set OPENAI_API_KEY in .env to transcribe with OpenAI.");
    return {
      model: WHISPER_MODEL,
      name,
      transcriber: makeTranscriber((speech) => transcribeOpenAI(speech, apiKey)),
    };
  }
  if (name === "local") {
    const modelPath = localModelPath(env);
    return {
      model: basename(modelPath),
      name,
      transcriber: makeTranscriber(
        (speech) =>
          transcribeLocal(
            speech,
            modelPath,
            env.INFLUENCA_WHISPER_BIN ?? "whisper-cli",
          ),
        () => ensureModel(modelPath),
      ),
    };
  }
  throw new Error(`Unknown transcriber "${name}"; choose openai or local.`);
}

/** Pure: the message out of an OpenAI error body, or the body itself if it is not one. */
export function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body.trim();
  } catch {
    return body.trim();
  }
}

/** User data cache location for a whisper.cpp model. */
export function localModelPath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.INFLUENCA_WHISPER_MODEL ??
    join(
      env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "influenca",
      "models",
      "ggml-base.en.bin",
    )
  );
}

/** Pure: Whisper's segments as a WebVTT file. */
export function toVtt(segments: Segment[]): string {
  const cues = segments.map(
    (s) => `${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text.trim()}\n`,
  );
  return ["WEBVTT\n", ...cues].join("\n");
}

async function ensureModel(modelPath: string) {
  try {
    await access(modelPath);
  } catch {
    throw new Error(
      `Local Whisper model not found at ${modelPath}. Set INFLUENCA_WHISPER_MODEL or place a model there.`,
    );
  }
}

function makeTranscriber(
  backend: (speechPath: string) => Promise<Heard>,
  beforeExtract?: () => Promise<void>,
): Transcriber {
  return {
    async transcribe(path, { durationSec, onProgress }) {
      await beforeExtract?.();
      const scratch = await mkdtemp(join(tmpdir(), "influenca-"));
      try {
        const speech = join(scratch, "speech.wav");
        const log = await runFfmpeg(
          ["-v", "info", "-y", "-i", path, ...SPEECH_ARGS, speech],
          durationSec,
          (fraction) => onProgress(fraction / 2),
        );
        if (durationSec - detectedSec(log, "silence_", durationSec) < 1) return;
        const heard = await backend(speech);
        onProgress(1);
        return heard;
      } finally {
        await rm(scratch, { force: true, recursive: true });
      }
    },
  };
}

function segmentTime(timestamp: string | undefined, offset: number | undefined) {
  if (timestamp) {
    const parts = timestamp.split(":").map(Number);
    return parts.reduce((seconds, part) => seconds * 60 + part, 0);
  }
  return (offset ?? 0) / 1000;
}

async function transcribeLocal(
  speech: string,
  modelPath: string,
  executable: string,
): Promise<Heard> {
  const outputBase = join(dirname(speech), "transcript");
  try {
    await execFileAsync(
      executable,
      ["-m", modelPath, "-f", speech, "-oj", "-of", outputBase],
      { maxBuffer: 10 * 1024 * 1024 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${executable} not found; install whisper.cpp or set INFLUENCA_WHISPER_BIN.`,
        { cause: error },
      );
    }
    throw new Error(
      `Local Whisper failed: ${(error as Error).message}`,
      { cause: error },
    );
  }
  const result = JSON.parse(await readFile(`${outputBase}.json`, "utf8")) as {
    result?: { language?: string };
    transcription?: {
      offsets?: { from?: number; to?: number };
      text?: string;
      timestamps?: { from?: string; to?: string };
    }[];
  };
  const segments = (result.transcription ?? []).map((segment) => ({
    end: segmentTime(segment.timestamps?.to, segment.offsets?.to),
    start: segmentTime(segment.timestamps?.from, segment.offsets?.from),
    text: segment.text ?? "",
  }));
  const text = segments.map((segment) => segment.text).join(" ");
  return {
    language: result.result?.language ?? "unknown",
    vtt: toVtt(segments),
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

async function transcribeOpenAI(speech: string, apiKey: string): Promise<Heard> {
  const form = new FormData();
  form.set("file", new Blob([await readFile(speech)]), "speech.wav");
  form.set("model", WHISPER_MODEL);
  form.set("response_format", "verbose_json");
  const response = await fetch(ENDPOINT, {
    body: form,
    headers: { Authorization: "Bearer " + apiKey },
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
}

/** 3661.5 -> 01:01:01.500 */
function vttTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}.${pad(ms % 1000, 3)}`;
}
