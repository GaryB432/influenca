import {
  type EntryAnalysis,
  formatDuration,
  type Manifest,
  MANIFEST_FILENAME,
  type ManifestEntry,
  summarize,
  type Transcript,
} from "@influenca/core";
import { readManifest, updateManifest } from "@influenca/core/node";
import { join, resolve } from "node:path";

import { identify } from "./entries.js";
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
  /** Measure again even if the run has been measured before. */
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

  // Measured before, and not asked to again: what is on the entries is shown as it is.
  const measuredAt = opts.redo ? undefined : manifest.analyzedAt;
  const found = (e: ManifestEntry, a?: EntryAnalysis) =>
    [...measured(e, a), ...said(e.transcript, opts.language)].join("  ");

  const identity = identify(manifest.entries);
  const table = startTable(
    manifest.entries.map((e) => ({
      cells: [...identity(e), e.kind, size(e)],
      weight: e.kind === "image" ? 0 : e.durationSec,
    })),
  );
  try {
    if (measuredAt) {
      manifest.entries.forEach((e, i) => table.set(i, found(e, e.analysis)));
    } else {
      await measureRun(dir, manifest, table, found);
    }
  } finally {
    table.end();
  }

  const words = manifest.entries.reduce(
    (sum, e) =>
      sum + (e.transcript?.status === "done" ? e.transcript.words : 0),
    0,
  );
  log(
    manifest.entries.some((e) => e.transcript)
      ? `Total words: ${words}`
      : dim(
          `No transcripts; run \`${invocation()} transcribe\` for what was said.`,
        ),
  );
  log(
    measuredAt
      ? dim(`Measured ${measuredAt}; pass --redo to measure again.`)
      : `Saved what was measured to ${accent(join(dir, MANIFEST_FILENAME))}`,
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

/** Measures every video and audio file in the run, row by row, and saves what it found to the manifest. */
async function measureRun(
  dir: string,
  manifest: Manifest,
  table: ReturnType<typeof startTable>,
  found: (e: ManifestEntry, a?: EntryAnalysis) => string,
): Promise<void> {
  const measurements = new Map<string, EntryAnalysis>();
  for (const [i, e] of manifest.entries.entries()) {
    if (e.kind === "image") {
      table.set(i, found(e));
      continue;
    }
    const has = {
      audio: e.kind === "audio" || e.hasAudio === true,
      video: e.kind === "video",
    };
    measurements.set(
      e.id,
      await table.run(
        i,
        (report) =>
          measure(join(dir, e.outputName), has, e.durationSec, report),
        (a) => found(e, a),
      ),
    );
  }
  // Saved once, at the end, into the manifest as it stands by then: a title given on the
  // web page while this ran is not undone.
  await updateManifest(dir, (latest) => {
    for (const e of latest.entries) {
      const analysis = measurements.get(e.id);
      if (analysis) e.analysis = analysis;
    }
    latest.analyzedAt = new Date().toISOString();
  });
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
