import {
  type Analysis,
  ANALYSIS_FILENAME,
  type EntryAnalysis,
  formatDuration,
  type Manifest,
  type ManifestEntry,
  summarize,
  type Transcript,
} from "@influenca/core";
import {
  readAnalysis,
  readManifest,
  readTranscripts,
} from "@influenca/core/node";
import { rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { invocation } from "./invocation.js";
import { startTable } from "./live.js";
import { measure } from "./measure.js";
import { latestRun, mediaDir } from "./paths.js";
import { accent, dim, log, next } from "./theme.js";

export type AnalyzeOptions = {
  inDir?: string;
  /** The language you expect to hear, as Whisper names it. Transcripts in another say so. */
  language: string;
  /** Totals from the manifest only: measures nothing and writes nothing. */
  minimal: boolean;
  /** Measure again even if the run already has an analysis file. */
  redo?: boolean;
};

export async function runAnalyze(opts: AnalyzeOptions): Promise<void> {
  const dir = opts.inDir ? resolve(opts.inDir) : await latestRun(mediaDir());
  const manifest = await readManifest(dir);
  const s = summarize(manifest);

  log(accent(dir));
  log(
    `Videos: ${s.counts.video}  Audio: ${s.counts.audio}  Images: ${s.counts.image}`,
  );
  log(`Total frames: ${s.totalFrames}`);
  if (opts.minimal) return;
  log(`Total duration: ${formatDuration(s.totalDurationSec)}`);

  const existing = opts.redo ? undefined : await readAnalysis(dir);
  const transcripts = await readTranscripts(dir);
  const found = (e: ManifestEntry, a?: EntryAnalysis) =>
    [
      ...measured(e, a),
      ...said(transcripts?.entries[e.id], opts.language),
    ].join("  ");

  const table = startTable(
    manifest.entries.map((e) => ({
      cells: [e.id, e.outputName, e.kind, size(e)],
      weight: e.kind === "image" ? 0 : e.durationSec,
    })),
  );
  try {
    if (existing) {
      manifest.entries.forEach((e, i) =>
        table.set(i, found(e, existing.entries[e.id])),
      );
    } else {
      await measureRun(dir, manifest, table, found);
    }
  } finally {
    table.end();
  }

  const words = manifest.entries.reduce((sum, e) => {
    const t = transcripts?.entries[e.id];
    return sum + (t?.status === "done" ? t.words : 0);
  }, 0);
  log(
    transcripts
      ? `Total words: ${words}`
      : dim(
          `No transcripts; run \`${invocation()} transcribe\` for what was said.`,
        ),
  );
  log(
    existing
      ? dim(
          `Analysis from ${existing.createdAt}; pass --redo to measure again.`,
        )
      : `Wrote analysis to ${accent(join(dir, ANALYSIS_FILENAME))}`,
  );
  if (s.estimated) {
    log(
      dim(
        "Note: files that could not be probed show estimated frames and durations.",
      ),
    );
  }
  // The viewer is a script of this repo, so it is only offered when that is where we are.
  if (invocation().startsWith("pnpm ")) next("pnpm dev:web");
}

/** What analyze worked out about one file, as the cells that follow its name and size. */
function measured(e: ManifestEntry, a: EntryAnalysis = {}): string[] {
  if (e.kind === "image") return [];
  const share = (sec: number) => `${Math.round((sec / e.durationSec) * 100)}%`;
  return [
    // At fixed quality a busier picture costs more bits, so this doubles as a rough activity hint.
    ...(e.kind === "video"
      ? [`${((e.bytes * 8) / e.durationSec / 1e6).toFixed(1)} Mb/s`]
      : []),
    ...(a.stillSec === undefined ? [] : [`still ${share(a.stillSec)}`]),
    ...(a.silentSec === undefined ? [] : [`silent ${share(a.silentSec)}`]),
  ];
}

/** Measures every video and audio file in the run, row by row, and writes the analysis file beside the manifest. */
async function measureRun(
  dir: string,
  manifest: Manifest,
  table: ReturnType<typeof startTable>,
  found: (e: ManifestEntry, a?: EntryAnalysis) => string,
): Promise<void> {
  const path = join(dir, ANALYSIS_FILENAME);
  const analysis: Analysis = {
    createdAt: new Date().toISOString(),
    entries: {},
    version: 1,
  };

  for (const [i, e] of manifest.entries.entries()) {
    if (e.kind === "image") {
      table.set(i, found(e));
      continue;
    }
    const has = {
      audio: e.kind === "audio" || e.hasAudio === true,
      video: e.kind === "video",
    };
    analysis.entries[e.id] = await table.run(
      i,
      (report) => measure(join(dir, e.outputName), has, e.durationSec, report),
      (a) => found(e, a),
    );
  }
  // Write beside, then rename, so an interrupted run never leaves half a file.
  await writeFile(`${path}.tmp`, JSON.stringify(analysis, null, 2));
  await rename(`${path}.tmp`, path);
}

/** How much was said, which is its own hint of what a file holds. */
function said(t: Transcript | undefined, primary: string): string[] {
  if (t?.status === "failed") return ["transcript failed"];
  if (t?.status !== "done") return [];
  // With no words there is no language to speak of.
  const other =
    t.words === 0 || t.language === primary ? "" : ` (${t.language})`;
  return [`${t.words} words${other}`];
}

/** How long a file is, in the unit that suits its kind. */
function size(e: ManifestEntry): string {
  if (e.kind === "image") return "1 frame";
  return e.kind === "video"
    ? `${e.frameCount} frames`
    : formatDuration(e.durationSec);
}
