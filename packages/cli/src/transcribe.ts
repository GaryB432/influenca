import {
  type ManifestEntry,
  type Transcript,
  type Transcripts,
  TRANSCRIPTS_FILENAME,
} from "@influenca/core";
import { readManifest, readTranscripts } from "@influenca/core/node";
import { rename, writeFile } from "node:fs/promises";
import { join, parse, resolve } from "node:path";

import { startBar } from "./bar.js";
import { howToSet, latestRun, mediaDir } from "./paths.js";
import { accent, dim, log, warn } from "./theme.js";
import { RejectedError, transcribe, WHISPER_MODEL } from "./whisper.js";

export type TranscribeOptions = {
  inDir?: string;
  /** Send every file again, including those already transcribed. This is paid for again. */
  redo?: boolean;
};

type Media = Exclude<ManifestEntry, { kind: "image" }>;

/** Catches a run up: accession transcribes as it goes, so this is for what that left undone. */
export async function runTranscribe(opts: TranscribeOptions): Promise<void> {
  const dir = opts.inDir ? resolve(opts.inDir) : await latestRun(mediaDir());
  log(accent(dir));
  if ((await transcribeRun(dir, opts.redo)) === 0) {
    log(dim("Nothing left to transcribe; pass --redo to send it again."));
  }
}

/**
 * Sends each file with sound to Whisper, once, and writes its transcript beside it. A
 * file Whisper turns down is recorded as failed and not sent again; anything else that
 * goes wrong throws, and the next call sends only what is still missing. Resolves with
 * how many files there were to do.
 */
export async function transcribeRun(
  dir: string,
  redo = false,
): Promise<number> {
  const manifest = await readManifest(dir);
  const transcripts: Transcripts = (redo
    ? undefined
    : await readTranscripts(dir)) ?? {
    createdAt: new Date().toISOString(),
    entries: {},
    version: 1,
  };
  const media = manifest.entries.filter((e) => e.kind !== "image");
  const todo = media.filter(
    (e) => (e.kind === "audio" || e.hasAudio) && !transcripts.entries[e.id],
  );
  if (todo.length === 0) return 0;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`${howToSet("OPENAI_API_KEY")} to transcribe.`);

  const names = vttNames(media);
  const path = join(dir, TRANSCRIPTS_FILENAME);
  const made: Transcript[] = [];
  const bar = startBar(todo.reduce((sum, e) => sum + e.durationSec, 0));
  try {
    for (const e of todo) {
      const vttName = names.get(e.id) ?? `${e.outputName}.vtt`;
      const transcript = await bar.job(
        e.durationSec,
        e.outputName,
        async (report): Promise<Transcript> => {
          try {
            const heard = await transcribe(
              join(dir, e.outputName),
              apiKey,
              e.durationSec,
              report,
            );
            if (!heard) return { status: "silent" };
            await writeFile(join(dir, vttName), heard.vtt);
            return {
              language: heard.language,
              model: WHISPER_MODEL,
              status: "done",
              vttName,
              words: heard.words,
            };
          } catch (error) {
            if (!(error instanceof RejectedError)) throw error;
            return {
              model: WHISPER_MODEL,
              reason: error.message,
              status: "failed",
            };
          }
        },
      );
      made.push((transcripts.entries[e.id] = transcript));
      // After every file, so a run that is stopped has paid for nothing it lost. Written
      // beside, then renamed, so it never leaves half a file.
      await writeFile(`${path}.tmp`, JSON.stringify(transcripts, null, 2));
      await rename(`${path}.tmp`, path);
    }
  } catch (error) {
    bar.fail("Transcription failed");
    throw error;
  }

  const count = (status: Transcript["status"]) =>
    made.filter((t) => t.status === status).length;
  bar.finish(
    `Transcribed ${count("done")} of ${todo.length} files` +
      (count("silent") ? `, ${count("silent")} with nothing to hear` : ""),
  );
  for (const e of todo) {
    const t = transcripts.entries[e.id];
    if (t?.status === "failed") {
      warn(`  ${e.outputName}: not transcribed: ${t.reason}`);
    }
  }
  return todo.length;
}

/**
 * VID00010.mp4 gets VID00010.vtt, the name players look for beside a video. Two kept
 * files can share a stem (a.mp3 and a.mp4), so the later one keeps its extension:
 * a.mp4.vtt. Worked out from the whole run, so a file's name is the same on every run.
 */
export function vttNames(media: Media[]): Map<string, string> {
  const taken = new Set<string>();
  return new Map(
    media.map((e) => {
      const plain = `${parse(e.outputName).name}.vtt`;
      const free = !taken.has(plain.toLowerCase()); // NTFS is case-insensitive
      taken.add(plain.toLowerCase());
      return [e.id, free ? plain : `${e.outputName}.vtt`];
    }),
  );
}
