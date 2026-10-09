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

import { startBar } from "./bar.js";
import { measure } from "./measure.js";
import { latestRun, mediaDir } from "./paths.js";
import { accent, dim, log } from "./theme.js";

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
  const analysis = existing ?? (await measureRun(dir, manifest));
  const transcripts = await readTranscripts(dir);
  let words = 0;
  for (const e of manifest.entries) {
    const t = transcripts?.entries[e.id];
    if (t?.status === "done") words += t.words;
    log(
      `  ${[e.outputName, e.kind, ...details(e, analysis.entries[e.id]), ...said(t, opts.language)].join("  ")}`,
    );
  }
  log(
    transcripts
      ? `Total words: ${words}`
      : dim("No transcripts; run `influenca transcribe` for what was said."),
  );
  if (existing) {
    log(
      dim(`Analysis from ${existing.createdAt}; pass --redo to measure again.`),
    );
  }
  if (s.estimated) {
    log(
      dim(
        "Note: files that could not be probed show estimated frames and durations.",
      ),
    );
  }
}

function details(e: ManifestEntry, a: EntryAnalysis = {}): string[] {
  if (e.kind === "image") return ["1 frame"];
  const share = (sec: number) => `${Math.round((sec / e.durationSec) * 100)}%`;
  return [
    e.kind === "video"
      ? `${e.frameCount} frames`
      : formatDuration(e.durationSec),
    // At fixed quality a busier picture costs more bits, so this doubles as a rough activity hint.
    ...(e.kind === "video"
      ? [`${((e.bytes * 8) / e.durationSec / 1e6).toFixed(1)} Mb/s`]
      : []),
    ...(a.stillSec === undefined ? [] : [`still ${share(a.stillSec)}`]),
    ...(a.silentSec === undefined ? [] : [`silent ${share(a.silentSec)}`]),
  ];
}

/** Measures every video and audio file in the run and writes the analysis file beside the manifest. */
async function measureRun(dir: string, manifest: Manifest): Promise<Analysis> {
  const media = manifest.entries.filter((e) => e.kind !== "image");
  const path = join(dir, ANALYSIS_FILENAME);
  const analysis: Analysis = {
    createdAt: new Date().toISOString(),
    entries: {},
    version: 1,
  };

  const bar = startBar(media.reduce((sum, e) => sum + e.durationSec, 0));
  try {
    for (const e of media) {
      const has = {
        audio: e.kind === "audio" || e.hasAudio === true,
        video: e.kind === "video",
      };
      analysis.entries[e.id] = await bar.job(
        e.durationSec,
        e.outputName,
        (report) =>
          measure(join(dir, e.outputName), has, e.durationSec, report),
      );
    }
    // Write beside, then rename, so an interrupted run never leaves half a file.
    await writeFile(`${path}.tmp`, JSON.stringify(analysis, null, 2));
    await rename(`${path}.tmp`, path);
  } catch (error) {
    bar.fail("Analysis failed");
    throw error;
  }
  bar.finish(`Wrote analysis to ${accent(path)}`);
  return analysis;
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
