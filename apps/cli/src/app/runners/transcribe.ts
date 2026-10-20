import {
  formatDuration,
  type ManifestEntry,
  type Transcript,
} from "@influenca/core";
import { readManifest, updateEntry } from "@influenca/core/node";
import { writeFile } from "node:fs/promises";
import { join, parse, resolve } from "node:path";

import { RejectedError, transcribe, WHISPER_MODEL } from "../svc/whisper.js";
import { accent, dim, log, next } from "../theme.js";
import { identify } from "../utils/entries.js";
import { invocation } from "../utils/invocation.js";
import { type RowState, startTable } from "../utils/live.js";
import { latestRun, mediaDir } from "../utils/paths.js";

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
  next(`${invocation()} analyze ${/\s/.test(dir) ? `"${dir}"` : dir}`);
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
  const media = manifest.entries.filter((e) => e.kind !== "image");
  // Asked to redo, what was heard before is passed over and every file is sent again.
  const before = (e: Media) => (redo ? undefined : e.transcript);
  const todo = media.filter(
    (e) => (e.kind === "audio" || e.hasAudio) && !before(e),
  );
  if (todo.length === 0) return 0;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY in .env to transcribe.");

  const names = vttNames(media);
  const made: Transcript[] = [];
  // Every file with sound gets a row, so what was done before shows beside what is done now.
  const heardable = media.filter((e) => e.kind === "audio" || e.hasAudio);
  log(
    `Transcribing ${todo.length} of ${heardable.length} with ${WHISPER_MODEL}`,
  );
  const identity = identify(manifest.entries);
  const table = startTable(
    heardable.map((e) => ({
      cells: [...identity(e), e.kind, formatDuration(e.durationSec)],
      weight: todo.includes(e) ? e.durationSec : 0,
    })),
  );
  try {
    for (const [i, e] of heardable.entries()) {
      const had = before(e);
      if (had) {
        table.set(i, outcome(had).tail, outcome(had).state);
        continue;
      }
      const vttName = names.get(e.id) ?? `${e.outputName}.vtt`;
      const transcript = await table.run(
        i,
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
        outcome,
      );
      made.push(transcript);
      // After every file, so a run that is stopped has paid for nothing it lost.
      await updateEntry(dir, e.id, { transcript });
    }
  } finally {
    table.end();
  }

  const count = (status: Transcript["status"]) =>
    made.filter((t) => t.status === status).length;
  log(
    `Transcribed ${count("done")} of ${todo.length} files` +
      (count("silent") ? `, ${count("silent")} with nothing to hear` : "") +
      (count("failed") ? `, ${count("failed")} turned down` : ""),
  );
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

/** What a transcript leaves on its file's row. */
function outcome(t: Transcript): { state: RowState; tail: string } {
  if (t.status === "silent")
    return { state: "skipped", tail: "nothing to hear" };
  if (t.status === "failed") {
    return { state: "failed", tail: `not transcribed: ${t.reason}` };
  }
  return {
    state: "done",
    tail: `${t.words} words${t.words === 0 ? "" : ` (${t.language})`}`,
  };
}
