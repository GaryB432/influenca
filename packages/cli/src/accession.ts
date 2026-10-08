import type {
  AbbreviatedTranscriptionMetadata,
  Manifest,
  Transcription,
  TranscriptionSegment,
  VideoEntry,
  VideoStatisticalBlock,
} from "@influenca/core";

import { outro } from "@clack/prompts";
import { fs as coreFs } from "@influenca/core";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import OpenAI from "openai";

import { startBar } from "./bar.js";
import * as color from "./color";
import { convert } from "./convert.js";
import { type OnProgress, runFfmpeg } from "./ffmpeg.js";
import { analyzeMotion, calculateActivityScore } from "./motion";
import { probe } from "./probe.js";
import { generateMissingVideo } from "./video-fill";

export type AccessionOptions = {
  dryRun: boolean;
  inDir: string;
  noTimestamp: boolean;
  noTranscribe: boolean;
  openAiKey?: string;
  outDir?: string;
  verbose: boolean;
};

export type AccessionWorkflowOptions = {
  dryRun: boolean;
  inDir: string;
  openAiKey: string;
  outDir: string;
  transcribe: boolean;
  verbose: boolean;
};

export type AccessionWorkflowProgress = {
  completedFiles: number;
  currentFile?: string;
  totalFiles: number;
};

export type AccessionWorkflowResult = {
  failedFiles: number;
  manifestPath: string;
  matchedFiles: number;
  outDir: string;
  processedFiles: number;
  transcribedFiles: number;
};

const baseTempDir = fs.realpathSync(os.tmpdir());

let temporary_for_wav_work: fs.DisposableTempDir | undefined;

export function formatSummary(
  result: AccessionWorkflowResult,
  dryRun?: boolean,
): string {
  if (dryRun) {
    return `Dry run complete: matched ${result.matchedFiles} file(s) in ${result.outDir}.`;
  }

  const tone = { ...color.summaryTone };

  const rows: Array<[label: string, value: string]> = [
    ["processed files", String(result.processedFiles)],
    ["matched files", String(result.matchedFiles)],
    ["failedFiles", String(result.failedFiles)],
    ["transcribed files", String(result.transcribedFiles)],
    ["output dir", result.outDir],
  ];
  const labelWidth = rows.reduce(
    (max, [label]) => Math.max(max, label.length),
    0,
  );

  const paths = ["manifest", "output dir"];

  const prettyRows = rows.map(([label, value]) => {
    const paddedLabel = `${label.padEnd(labelWidth)}:`;
    const isPath = paths.includes(label);
    const colorizedValue = isPath ? tone.path(value) : tone.number(value);
    return `${tone.label(paddedLabel)} ${colorizedValue}`;
  });

  return [
    tone.heading("Accession stats"),
    tone.accent("-----------------------------"),
    ...prettyRows,
    tone.heading("Next step"),
    [
      process.argv[1],
      color.maybeColorize(6, "analyze"),
      tone.path(result.outDir),
    ].join(" "),
  ].join("\n");
}

/** Resolves what the flags leave open, runs the workflow, and prints its summary. */
export async function runAccession(opts: AccessionOptions): Promise<void> {
  const base = opts.outDir ?? process.env.INFLUENCA_MEDIA_DIR;
  if (!base) {
    throw new Error(
      "outDir is required. Provide --out-dir or INFLUENCA_MEDIA_DIR.",
    );
  }
  const openAiKey = opts.openAiKey ?? process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    throw new Error(
      "openAiKey is required. Provide --open-ai-key or OPENAI_API_KEY.",
    );
  }

  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const result = await runAccessionWorkflow({
    dryRun: opts.dryRun,
    inDir: opts.inDir,
    openAiKey,
    outDir: opts.noTimestamp ? base : path.join(base, stamp),
    transcribe: !opts.noTranscribe,
    verbose: opts.verbose,
  });

  outro(
    [
      formatSummary(result, opts.dryRun),
      [color.color256(4, WEB_APP_ORIGIN), color.color256(12, stamp)].join("/"),
    ].join("\n"),
  );
}

export async function runAccessionWorkflow(
  options: AccessionWorkflowOptions,
): Promise<AccessionWorkflowResult> {
  if (options.verbose) {
    throw new Error("verbosity is a matter for the terminal layer");
  }
  if (options.dryRun) {
    throw new Error("revisit what that means");
  }
  if (!options.outDir) {
    throw new Error("outDir is required.");
  }

  const outDir = options.outDir;
  const manifestPath = path.join(outDir, ".influenca.json");
  const files = fs.readdirSync(options.inDir);

  const every_media_parts = files
    .map((f) => path.parse(f))
    .filter((p) => p.ext.toLowerCase().match(/\.(avi|mp4|wav)$/));

  const media_parts = every_media_parts.slice(0, limit);

  const manifest: Manifest = {};

  if (!options.dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    temporary_for_wav_work = fs.mkdtempDisposableSync(
      path.join(baseTempDir, "influenca-"),
    );
  }

  let failedFiles = 0;
  const matchedFiles = media_parts.length;
  let processedFiles = 0;
  let transcribedFiles = 0;

  // Each file is weighted by its input size.
  const sizes = media_parts.map(
    (p) => fs.statSync(path.join(options.inDir, path.format(p))).size,
  );
  const bar = startBar(sizes.reduce((sum, bytes) => sum + bytes, 0));

  for (const [i, path_part] of media_parts.entries()) {
    try {
      const videoEntry = await bar.job(sizes[i] ?? 0, path_part.base, (report) =>
        createVideoEntry(options, path_part, report),
      );
      manifest[path_part.name] = videoEntry;
      processedFiles += 1;
      if (videoEntry.transcript) {
        transcribedFiles += 1;
      }
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
    }
  }

  if (!options.dryRun) {
    coreFs.writeJSONSync<Manifest>(manifestPath, manifest, {
      stringify: { replacer: null, space: 2 },
    });
    if (temporary_for_wav_work) {
      temporary_for_wav_work.remove();
    }
  }
  bar.finish(color.summaryTone.path(options.outDir));

  return {
    failedFiles,
    manifestPath,
    matchedFiles,
    outDir,
    processedFiles,
    transcribedFiles,
  };
}

export async function transcribeAudio(
  options: AccessionWorkflowOptions,
  soundPath: string,
  scratchPath: string,
): Promise<Transcription | undefined> {
  const getAudioPathFromSoundPath = () =>
    runFfmpeg(
      [
        "-v",
        "error",
        "-y",
        "-i",
        soundPath,
        "-vn", // 1. Completely strip the video track
        "-c:a",
        "libmp3lame", // 2. Use native MP3 encoding
        "-ac",
        "1", // 3. Drop to mono (saves 50% file size)
        "-b:a",
        "32k", // 4. Shrink size (perfect for speech Whisper)
        "-map_metadata",
        "-1", // 5. Strip metadata tags
        scratchPath,
      ],
      0,
      () => {},
    ).then(
      () => scratchPath,
      (err: unknown) => {
        const e = err instanceof Error ? err.message : String(err);
        console.error("Ffmpeg Error details: ".concat(e));
        return undefined;
      },
    );

  const transcribeThisAudio = (the_audio: string) =>
    new Promise<Transcription | undefined>((resolve) => {
      if (!the_audio) {
        resolve(undefined);
        return;
      }

      const openai = new OpenAI({ apiKey: options.openAiKey });

      openai.audio.transcriptions
        .create({
          file: fs.createReadStream(the_audio),
          model: "whisper-1",
          response_format: "verbose_json",
        })
        .then((verbose_transcription) => {
          resolve(verbose_transcription);
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err.message : String(err);
          console.error("Error details: ".concat(e));
          resolve(undefined);
        });
    });

  const audio_scratch = await getAudioPathFromSoundPath();
  if (!audio_scratch) {
    return undefined;
  }
  if (audio_scratch !== scratchPath) throw new Error("not scratch");

  return await transcribeThisAudio(audio_scratch);
}

async function createVideoEntry(
  options: AccessionWorkflowOptions,
  path_part: path.ParsedPath,
  report: OnProgress,
): Promise<VideoEntry> {
  let video_slug = path_part.base;

  let transcript:
    | undefined
    | {
        meta: AbbreviatedTranscriptionMetadata;
        segments: string;
      };

  const mp4base = path.format({ ext: ".mp4", name: path_part.name });

  const mp4_FP = path.resolve(options.outDir, mp4base);

  // ffmpeg reports its position in seconds, so the bar needs the source's length.
  const src_FP = path.resolve(options.inDir, path.format(path_part));
  const src_seconds = Number((await probe(src_FP)).format?.duration) || 0;

  switch (path_part.ext.toLowerCase()) {
    case ".avi":
    case ".mp4": {
      await convert(src_FP, mp4_FP, "video", src_seconds, report);
      break;
    }
    case ".wav": {
      await generateMissingVideo(src_FP, mp4_FP, src_seconds, report);
      break;
    }
  }

  video_slug = path.parse(mp4_FP).base;

  const stats: VideoStatisticalBlock = await getVideoStatisticalBlock(mp4_FP);

  if (temporary_for_wav_work && options.transcribe) {
    const whisperTranscription = await transcribeAudio(
      options,
      mp4_FP,
      path.join(temporary_for_wav_work.path, mp4base),
    );

    if (whisperTranscription) {
      const segmentJsonPath = path.format({
        ext: ".vtt",
        name: path_part.name,
      });
      const outputSegmentsPath = path.join(options.outDir, segmentJsonPath);

      transcript = {
        meta: {
          duration: whisperTranscription.duration,
          language: whisperTranscription.language,
        },
        segments: segmentJsonPath,
      };

      coreFs.writeJSONSync<TranscriptionSegment[]>(
        outputSegmentsPath,
        whisperTranscription.segments ?? [],
        {
          stringify: { replacer: null, space: 2 },
        },
      );
    }
  }

  const video: Record<string, { stats: VideoStatisticalBlock }> = {};

  video[video_slug] = {
    stats,
  };

  return {
    transcript,
    video,
  };
}

async function getVideoStatisticalBlock(
  videoPath: string,
): Promise<VideoStatisticalBlock> {
  const probeResult = await probe(videoPath);
  const videoStream = probeResult.streams?.find(
    (stream) => stream.codec_type === "video",
  );

  // const arbitraryFutureMetric = "tbd";
  const duration_seconds = parseInt(probeResult.format?.duration ?? "0", 10);
  const frames = parseInt(videoStream?.nb_frames ?? "0", 10);

  // theoretical max stdev of an 8-bit luma signal, used to normalize detail ratio
  const globalMaxStdev = 128;
  const interestScore = calculateActivityScore(
    (await analyzeMotion(videoPath)).frames,
    globalMaxStdev,
  );

  return { duration_seconds, frames, interestScore };
}

const WEB_APP_ORIGIN = "http://localhost:5173";
const limit = Infinity;
