import type { FfprobeData } from "fluent-ffmpeg";

import { console_wrapper as coolsole } from "@influenca/shared";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import OpenAI from "openai";

import type {
  AbbreviatedTranscriptionMetadata,
  Manifest,
  ProgressOptions,
  ProgressResult,
  Transcription,
  TranscriptionSegment,
  VideoEntry,
  VideoStatisticalBlock,
} from "../index";

import * as color from "../color";
import { analyzeMotion, calculateActivityScore } from "../motion";
import { writeJSONSync } from "../shims/fs";
import { generateMissingVideo } from "./video-fill";

export type AccessionWorkflowOptions = {
  dryRun: boolean;
  inDir: string;
  meter: (options: ProgressOptions) => ProgressResult;
  openAiKey: string;
  outDir: string;
  stitch: boolean;
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

type MF = Record<string, VR>;

type VR = Pick<VideoEntry, "video">;

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

  const progress = options.meter({ max: matchedFiles });
  progress.start(color.summaryTone.path(options.outDir));

  for (const path_part of media_parts) {
    try {
      const videoEntry = await createVideoEntry(options, path_part);
      manifest[path_part.name] = videoEntry;
      processedFiles += 1;
      if (videoEntry.transcript) {
        transcribedFiles += 1;
      }
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      coolsole.error(message);
      // progress.message('nope')
    }
    progress.advance(
      processedFiles + failedFiles,
      `${path_part.base} complete`,
    );
  }

  if (!options.dryRun) {
    writeJSONSync<Manifest>(manifestPath, manifest, {
      stringify: { replacer: null, space: 2 },
    });
    if (temporary_for_wav_work) {
      temporary_for_wav_work.remove();
    }
  }
  progress.stop();

  return {
    failedFiles,
    manifestPath,
    matchedFiles,
    outDir,
    processedFiles,
    transcribedFiles,
  };
}

export async function stitch(input: MF): Promise<Manifest> {
  const temporary_result = Object.keys(input).reduce((accum, slug) => {
    const infoa = input[slug];

    if (infoa) {
      // const v: VideoEntry = {
      //   transcript: undefined,
      //   video: {},
      //   ...mnfst[slug],
      // };

      // console.log(b);
      // a[b] = { transcript: undefined, video: {} };
      // console.log(qqf);

      const newve: VideoEntry = {
        transcript: undefined,
        ...infoa,
      };

      accum[slug] = newve;
    }
    return accum;
  }, {} as Manifest);

  // const f = Object.keys(m).map((slug) => {
  //   return { slug, fun: true };
  // });

  return temporary_result;
}

export async function transcribeAudio(
  options: AccessionWorkflowOptions,
  soundPath: string,
  scratchPath: string,
): Promise<Transcription | undefined> {
  const getAudioPathFromSoundPath = () =>
    new Promise<string | undefined>((resolve) => {
      ffmpeg(soundPath)
        .noVideo() // 1. Completely strip the video track
        .audioCodec("libmp3lame") // 2. Use native MP3 encoding
        .audioChannels(1) // 3. Drop to mono (saves 50% file size)
        .audioBitrate("32k") // 4. Shrink size (perfect for speech Whisper)
        .outputOptions("-map_metadata -1") // 5. Strip metadata tags
        .output(scratchPath)
        .on("end", () => {
          resolve(scratchPath);
        })
        .on("error", (err: unknown) => {
          const e = err instanceof Error ? err.message : String(err);
          coolsole.error("Ffmpeg Error details: ".concat(e));
          resolve(undefined);
        })
        .run();
    });

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
          coolsole.error("Error details: ".concat(e));
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
): Promise<VideoEntry> {
  let video_slug = path_part.base;

  let transcript:
    | {
        meta: AbbreviatedTranscriptionMetadata;
        segments: string;
      }
    | undefined;

  const mp4base = path.format({ ext: ".mp4", name: path_part.name });

  const mp4_FP = path.resolve(options.outDir, mp4base);

  switch (path_part.ext.toLowerCase()) {
    case ".avi":
    case ".mp4": {
      await transcodeToMp4(
        path.resolve(options.inDir, path.format(path_part)),
        mp4_FP,
        !really_call_ffmpeg,
      );
      break;
    }
    case ".wav": {
      const wav_fp = path.resolve(options.inDir, path.format(path_part));
      await generateMissingVideo(wav_fp, mp4_FP);
      break;
    }
  }

  video_slug = path.parse(mp4_FP).base;

  const stats: VideoStatisticalBlock = await getVideoStatisticalBlock(
    mp4_FP,
    !really_call_ffmpeg,
  );

  if (really_call_ffmpeg && temporary_for_wav_work && options.transcribe) {
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

      writeJSONSync<TranscriptionSegment[]>(
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
  drier: boolean,
): Promise<VideoStatisticalBlock> {
  const probeResult = await probeVideo(videoPath, drier);
  const videoStream = probeResult.streams.find(
    (stream) => stream.codec_type === "video",
  );

  // const arbitraryFutureMetric = "tbd";
  const duration_seconds = parseInt(videoStream?.duration ?? "0", 10);
  const frames = parseInt(videoStream?.nb_frames ?? "0", 10);

  // theoretical max stdev of an 8-bit luma signal, used to normalize detail ratio
  const globalMaxStdev = 128;
  const interestScore = drier
    ? 0
    : calculateActivityScore(
        (await analyzeMotion(videoPath)).frames,
        globalMaxStdev,
      );

  return { duration_seconds, frames, interestScore };
}

async function probeVideo(
  videoPath: string,
  drier: boolean,
): Promise<FfprobeData> {
  return new Promise<FfprobeData>((resolve, reject) => {
    if (drier) {
      coolsole.log("probeVideo");
      setTimeout(() => {
        resolve({
          chapters: [],
          format: {},
          streams: [],
        });
      }, 20000);
    } else {
      ffmpeg.ffprobe(videoPath, (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(data);
      });
    }
  });
}

async function transcodeToMp4(
  inputPath: string,
  outputVideoPath: string,
  drier: boolean,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (drier) {
      coolsole.log(
        JSON.stringify({
          inputPath,
          m: "transcodeToMp4",
          outputVideoPath,
        }),
      );
      setTimeout(() => {
        resolve();
      }, 5000);
    } else {
      ffmpeg(inputPath)
        .output(outputVideoPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .outputOptions("-crf", "23", "-preset", "fast")
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    }
  });
}

const really_call_ffmpeg = true;
const limit = Infinity;
