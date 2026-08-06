import type { FfprobeData } from "fluent-ffmpeg";

import { console_wrapper as coolsole } from "@influenca/shared";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import OpenAI from "openai";

import type {
  Manifest,
  ProgressOptions,
  ProgressResult,
  Transcription,
  TranscriptionSegment,
  VideoEntry,
  VideoStatisticalBlock,
} from "../index";

import * as color from "../color";
import { writeJSONSync } from "../shims/fs";
import { generateMissingVideo } from "./video-fill";

export type AccessionWorkflowOptions = {
  dryRun: boolean;
  inDir: string;
  meter: (options: ProgressOptions) => ProgressResult;
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

async function createVideoEntry(
  options: AccessionWorkflowOptions,
  path_part: path.ParsedPath,
): Promise<VideoEntry> {
  const finalized_stats = {
    duration_seconds: 0,
    frames: 0,
  };

  let segments = "coming later";

  const meta = {
    duration: 0,
    language: "",
  };

  let video_slug = path_part.base;

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

  const probeResult = await probeVideo(mp4_FP, !really_call_ffmpeg);
  const vid = probeResult.streams.find(
    (stream) => stream.codec_type === "video",
  );
  finalized_stats.duration_seconds = parseInt(vid?.duration ?? "0", 10);
  video_slug = path.parse(mp4_FP).base;

  finalized_stats.frames = parseInt(vid?.nb_frames ?? "0", 10);

  if (really_call_ffmpeg && temporary_for_wav_work && options.transcribe) {
    const whisperTranscription: Transcription | undefined =
      await transcribeAudio(
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

      segments = segmentJsonPath;
      meta.language = whisperTranscription.language;
      meta.duration = whisperTranscription.duration;

      writeJSONSync<TranscriptionSegment[]>(
        outputSegmentsPath,
        whisperTranscription.segments ?? [],
        {
          stringify: { replacer: null, space: 2 },
        },
      );
    }
  } else {
    coolsole.log(
      JSON.stringify({
        a: mp4_FP,
        m: "got audio",
      }),
    );
  }

  const video: Record<string, { stats: VideoStatisticalBlock }> = {};

  video[video_slug] = {
    stats: finalized_stats,
  };

  return {
    transcript: {
      meta,
      segments,
    },
    video,
  };
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

async function transcribeAudio(
  options: AccessionWorkflowOptions,
  soundPath: string,
  scratchPath: string,
): Promise<Transcription | undefined> {
  const ft: Transcription = {
    duration: 0,
    language: "",
    text: "",
  };

  const fakeGetAudio = (soundPath: string) => Promise.resolve("asdf");
  const fakeTranscribeIt = (mp3Path: string) => Promise.resolve(ft);

  const reportIt = (err: unknown) => {
    const e = err instanceof Error ? err.message : String(err);
    coolsole.error("Error details: ".concat(e));
  };

  try {
    await fakeGetAudio(soundPath);
    try {
      console.log(soundPath);
      const tx = await fakeTranscribeIt(soundPath);
      return tx;
    } catch (err) {
      reportIt(err);
    }
  } catch (err) {
    reportIt(err);
    return undefined;
  }

  // fakeGetAudio(soundPath).then(
  //   (p) => {
  //     console.log(p);
  //     fakeTranscribeIt(p).then(
  //       (tr) => {
  //         return tr;
  //       },
  //       (err) => {
  //         reportIt(err);
  //         return undefined
  //       },
  //     );
  //     return t;
  //   },
  //   (err) => {
  //     reportIt(err);
  //     return undefined;
  //   },
  // );

  // const p = new Promise<string>((a, b) => {
  //   a(soundPath);
  // });
  // p.then(
  //   (s) => {
  //     console.log(s);
  //     return t;
  //   },
  //   (err) => {
  //     return undefined;
  //   },
  // );

  // // try {} catch {}

  // // ffmpeg(soundPath).output(scratchPath).run();

  // return undefined;
}

async function ΘtranscribeAudio(
  options: AccessionWorkflowOptions,
  soundPath: string,
  outputPath: string,
): Promise<Transcription | undefined> {
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(soundPath)
        .noVideo() // 1. Completely strip the video track
        .audioCodec("libmp3lame") // 2. Use native MP3 encoding
        .audioChannels(1) // 3. Drop to mono (saves 50% file size)
        .audioBitrate("32k") // 4. Shrink size (perfect for speech Whisper)
        .outputOptions("-map_metadata -1") // 5. Strip metadata tags
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => {
          const e = err instanceof Error ? err.message : String(err);
          coolsole.error("FFmpeg Error details: ".concat(e));
          reject(err);
        })
        .run();
    });
    const openai = new OpenAI({ apiKey: options.openAiKey });

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(outputPath),
      model: "whisper-1",
      response_format: "verbose_json",
    });

    fs.unlinkSync(outputPath);
    return result;
  } catch {
    coolsole.error("just so you know there was an arror");
    return undefined;
  }
}

const really_call_ffmpeg = true;
const limit = Infinity;
