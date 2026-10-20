import {
  formatDuration,
  type Manifest,
  MANIFEST_FILENAME,
  type ManifestEntry,
} from "@influenca/core";
import {
  access,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import type { OnProgress } from "../service/ffmpeg.js";

import { applyProbe, isFfprobeMissing, probe } from "../service/probe.js";
import { accent, log, next, warn } from "../theme.js";
import { convert } from "../utils/convert.js";
import { copy } from "../utils/copy.js";
import { classify, type IntakeFile, planEntries } from "../utils/entries.js";
import { invocation } from "../utils/invocation.js";
import { startTable } from "../utils/live.js";
import { hasManifest, mediaDir, stamp } from "../utils/paths.js";
import { transcribeRun } from "./transcribe.js";

export type AccessionOptions = {
  dryRun: boolean;
  inDir: string;
  outDir?: string;
  /** Put the run in its own time-stamped folder under the output dir, not in the output dir itself. */
  timestamp: boolean;
  /** Send what was kept to Whisper. Off keeps the files and stops there. */
  transcribe: boolean;
  verbose: boolean;
};

export async function runAccession(opts: AccessionOptions): Promise<void> {
  const inDir = resolve(opts.inDir);
  const base = resolve(opts.outDir ?? mediaDir());
  const outDir = opts.timestamp ? join(base, stamp()) : base;

  if (await hasManifest(outDir)) {
    throw new Error(
      `Refusing to overwrite: ${join(outDir, MANIFEST_FILENAME)} already exists. ` +
        "Use a new --out-dir or drop --no-timestamp.",
    );
  }

  log(accent(outDir));
  const files = await listIntake(inDir, opts.verbose);
  const planned = planEntries(files);
  if (planned.length === 0) {
    throw new Error(
      `No supported media (avi, heic, mov, mp4, wav, png, jpg) in ${inDir}`,
    );
  }
  const sources = await probeEntries(inDir, planned);

  // Each file is weighted by its input size.
  const table = startTable(
    sources.map((e) => ({
      cells: [e.id, e.sourceName, ...describe(e)],
      weight: e.bytes,
    })),
  );
  if (opts.dryRun) {
    sources.forEach((e, i) => table.set(i, `would be ${how(e)}`, "skipped"));
    table.end();
    log(`[dry-run] ${sources.length} file(s) would be written to ${outDir}`);
    return;
  }

  await mkdir(outDir, { recursive: true });
  try {
    const entries: ManifestEntry[] = [];
    for (const [i, e] of sources.entries()) {
      const src = join(inDir, e.sourceName);
      const dest = join(outDir, e.outputName);
      entries.push(
        await table.run(
          i,
          (report) => bringIn(e, src, dest, report),
          () => how(e),
        ),
      );
    }

    const manifest: Manifest = {
      createdAt: new Date().toISOString(),
      entries,
      version: 1,
    };
    await writeFile(
      join(outDir, MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2),
    );
  } finally {
    table.end();
  }
  log(`Wrote ${sources.length} entries to ${accent(outDir)}`);

  const quoted = /\s/.test(outDir) ? `"${outDir}"` : outDir;
  if (opts.transcribe) {
    // The run is whole from here on: the manifest is written, and nothing below can undo it.
    try {
      await transcribeRun(outDir);
    } catch (error) {
      warn(
        `Kept, but not all transcribed: ${error instanceof Error ? error.message : String(error)}`,
      );
      warn(`To finish: ${invocation()} transcribe ${quoted}`);
    }
  }
  next(`${invocation()} analyze ${quoted}`);
}

/**
 * Copies or converts one file and returns the entry describing what now sits in the run folder.
 * The work happens under a .part- name, so a file with its real name is always complete.
 */
async function bringIn(
  e: ManifestEntry,
  src: string,
  dest: string,
  report: OnProgress,
): Promise<ManifestEntry> {
  if (
    await access(dest).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(`Refusing to overwrite: ${dest} already exists.`);
  }
  // Same folder and same extension: the rename stays on one drive, and ffmpeg still sees the format.
  const part = join(dirname(dest), `.part-${basename(dest)}`);
  try {
    const kept = await (e.outputName === e.sourceName
      ? copy(src, part, e.bytes, report).then(() => e)
      : convertAndCheck(e, src, part, report));
    await rename(part, dest);
    return kept;
  } catch (error) {
    await rm(part, { force: true });
    throw error;
  }
}

/** Converts into part and returns the entry for the result, or throws if it cannot be trusted. */
async function convertAndCheck(
  e: ManifestEntry,
  src: string,
  part: string,
  report: OnProgress,
): Promise<ManifestEntry> {
  await convert(
    src,
    part,
    e.kind,
    e.kind === "image" ? 0 : e.durationSec,
    report,
    classify(e.sourceName)?.rewrap,
  );

  // The manifest describes the converted file, and a probe that disagrees with the
  // source means the conversion cannot be trusted as the only copy.
  const kept = applyProbe(e, await probe(part));
  if (
    kept.kind !== "image" &&
    e.kind !== "image" &&
    e.metaSource === "ffprobe"
  ) {
    const drift = Math.abs(kept.durationSec - e.durationSec);
    if (drift > DURATION_TOLERANCE_SEC) {
      throw new Error(
        `${e.outputName} is ${kept.durationSec}s but ${e.sourceName} is ${e.durationSec}s; not trusting the conversion.`,
      );
    }
  }
  return { ...kept, bytes: (await stat(part)).size };
}

/** What is known of a file before it is brought in, as the cells that follow its name. */
function describe(e: ManifestEntry): string[] {
  return [
    e.kind,
    e.kind === "image" ? "" : formatDuration(e.durationSec),
    (e.width && e.height ? `${e.width}x${e.height}` : "") +
      (e.metaSource === "estimated" ? " estimated" : ""),
  ];
}

/** What accession does with a file, in the past tense: it reads as the result once done. */
function how(e: ManifestEntry): string {
  if (e.outputName === e.sourceName) return "copied";
  const verb = classify(e.sourceName)?.rewrap ? "rewrapped as" : "converted to";
  return `${verb} ${e.outputName}`;
}

async function listIntake(
  inDir: string,
  verbose: boolean,
): Promise<IntakeFile[]> {
  const files: IntakeFile[] = [];
  for (const d of await readdir(inDir, { withFileTypes: true })) {
    if (!d.isFile()) continue;
    if (!classify(d.name)) {
      if (verbose) log(`  skipped (unsupported): ${d.name}`);
      continue;
    }
    files.push({ bytes: (await stat(join(inDir, d.name))).size, name: d.name });
  }
  return files;
}

/** Swaps size-based estimates for ffprobe's numbers, file by file, keeping the estimate on failure. */
async function probeEntries(
  inDir: string,
  planned: ManifestEntry[],
): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  for (const e of planned) {
    // ffprobe cannot read HEIC; the JPEG made from it is probed once it exists.
    if (e.kind === "image" && e.outputName !== e.sourceName) {
      entries.push(e);
      continue;
    }
    try {
      entries.push(applyProbe(e, await probe(join(inDir, e.sourceName))));
    } catch (error) {
      if (isFfprobeMissing(error)) {
        warn("ffprobe not found; durations and frame counts are estimates.");
        return planned;
      }
      warn(`Could not probe ${e.sourceName}; keeping its estimate.`);
      entries.push(e);
    }
  }
  return entries;
}

/** Encoder padding moves a duration by a few hundredths of a second; a truncated file by far more. */
const DURATION_TOLERANCE_SEC = 0.5;
