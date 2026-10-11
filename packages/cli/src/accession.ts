import {
  formatDuration,
  type Manifest,
  MANIFEST_FILENAME,
  type ManifestEntry,
} from "@influenca/core";
import { createReadStream, createWriteStream } from "node:fs";
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
import { pipeline } from "node:stream/promises";

import type { OnProgress } from "./ffmpeg.js";

import { startBar } from "./bar.js";
import { convert } from "./convert.js";
import { classify, type IntakeFile, planEntries } from "./entries.js";
import { hasManifest, mediaDir, stamp } from "./paths.js";
import { applyProbe, isFfprobeMissing, probe } from "./probe.js";
import { accent, log, warn } from "./theme.js";

export type AccessionOptions = {
  dryRun: boolean;
  inDir: string;
  noTimestamp: boolean;
  outDir?: string;
  verbose: boolean;
};

export async function runAccession(opts: AccessionOptions): Promise<void> {
  const inDir = resolve(opts.inDir);
  const base = resolve(opts.outDir ?? mediaDir());
  const outDir = opts.noTimestamp ? base : join(base, stamp());

  if (await hasManifest(outDir)) {
    throw new Error(
      `Refusing to overwrite: ${join(outDir, MANIFEST_FILENAME)} already exists. ` +
        "Use a new --out-dir or drop --no-timestamp.",
    );
  }

  const files = await listIntake(inDir, opts.verbose);
  const planned = planEntries(files);
  if (planned.length === 0) {
    throw new Error(`No supported media (avi, mov, mp4, wav, jpg) in ${inDir}`);
  }
  const sources = await probeEntries(inDir, planned);

  for (const e of sources) {
    const line = `${e.sourceName} -> ${e.outputName} (${describe(e)})`;
    if (opts.dryRun) log(`[dry-run] ${line}`);
    else if (opts.verbose) log(`• ${line}`);
  }
  if (opts.dryRun) {
    log(`[dry-run] ${sources.length} file(s) would be written to ${outDir}`);
    return;
  }

  const totalBytes = sources.reduce((sum, e) => sum + e.bytes, 0);
  await mkdir(outDir, { recursive: true });
  // Each file is weighted by its input size.
  const bar = startBar(totalBytes);
  try {
    const entries: ManifestEntry[] = [];
    for (const e of sources) {
      const src = join(inDir, e.sourceName);
      const dest = join(outDir, e.outputName);
      entries.push(
        await bar.job(e.bytes, e.sourceName, (report) =>
          bringIn(e, src, dest, report),
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
  } catch (error) {
    bar.fail("Accession failed");
    throw error;
  }
  bar.finish(
    `Wrote ${sources.length} entries to ${accent(outDir)}`,
    `Next: ${accent(`influenca analyze ${/\s/.test(outDir) ? `"${outDir}"` : outDir}`)}`,
  );
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
    const kept = await (e.kind === "image" || e.outputName === e.sourceName
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
  e: Exclude<ManifestEntry, { kind: "image" }>,
  src: string,
  part: string,
  report: OnProgress,
): Promise<ManifestEntry> {
  await convert(
    src,
    part,
    e.kind,
    e.durationSec,
    report,
    classify(e.sourceName)?.rewrap,
  );

  // The manifest describes the converted file, and a probe that disagrees with the
  // source means the conversion cannot be trusted as the only copy.
  const kept = applyProbe(e, await probe(part));
  if (kept.kind !== "image" && e.metaSource === "ffprobe") {
    const drift = Math.abs(kept.durationSec - e.durationSec);
    if (drift > DURATION_TOLERANCE_SEC) {
      throw new Error(
        `${e.outputName} is ${kept.durationSec}s but ${e.sourceName} is ${e.durationSec}s; not trusting the conversion.`,
      );
    }
  }
  return { ...kept, bytes: (await stat(part)).size };
}

async function copy(
  src: string,
  dest: string,
  bytes: number,
  onProgress: OnProgress,
): Promise<void> {
  let copied = 0;
  await pipeline(
    createReadStream(src),
    async function* (chunks: AsyncIterable<Buffer>) {
      for await (const chunk of chunks) {
        copied += chunk.length;
        if (bytes > 0) onProgress(copied / bytes);
        yield chunk;
      }
    },
    createWriteStream(dest),
  );
}

function describe(e: ManifestEntry): string {
  const parts: string[] = [e.kind];
  if (e.kind !== "image") parts.push(formatDuration(e.durationSec));
  if (e.kind === "video") parts.push(`${e.frameCount} frames`);
  if (e.width && e.height) parts.push(`${e.width}x${e.height}`);
  if (e.metaSource === "estimated") parts.push("estimated");
  return parts.join(", ");
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
