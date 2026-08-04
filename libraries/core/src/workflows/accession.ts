import type { FfprobeData } from "fluent-ffmpeg";

import { console_wrapper as coolsole } from "@influenca/shared";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";

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

const temporary_for_wav_work = "/tmp/wav";

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
    fs.mkdirSync(temporary_for_wav_work, { recursive: true });
  }

  let failedFiles = 0;
  const matchedFiles = media_parts.length;
  let processedFiles = 0;
  const transcribedFiles = 0;

  const progress = options.meter({ max: matchedFiles });
  progress.start(color.summaryTone.path(options.outDir));

  for (const path_part of media_parts) {
    const videoEntry = await createVideoEntry(options, path_part);

    manifest[path_part.name] = videoEntry;

    try {
      // all the stuff above
      processedFiles += 1;
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

async function create_wav_vid_return_not_justslug(
  path_part: path.ParsedPath,
  options: AccessionWorkflowOptions,
  duration: number | undefined,
): Promise<string> {
  const mp4name = path.format({ ext: ".mp4", name: path_part.name });

  const blank_mp4_FP = path.resolve(options.outDir, mp4name);

  const seconds = duration ?? 0;

  await generatePlaceholderVideo(blank_mp4_FP, seconds, !really_call_ffmpeg);

  // fs.writeFileSync(blank_mp4_FP, "not a real video yet", "utf-8");
  return mp4name;
}

async function createVideoEntry(
  options: AccessionWorkflowOptions,
  path_part: path.ParsedPath,
): Promise<VideoEntry> {
  const video_stats_to_finally_return = {
    duration_seconds: 0,
    frames: 0,
  };

  let segments = "tbd";

  const meta = {
    duration: 0,
    language: "",
  };

  let video_slug = path_part.base;

  const temporary_for_wav_work = "tmp/dudio";

  let audio_fp_for_whisper: string | undefined;

  const mp4base = path.format({ ext: ".mp4", name: path_part.name });

  switch (path_part.ext.toLowerCase()) {
    case ".avi": {
      const full_avi_path = path.resolve(options.inDir, path_part.base);

      const mp4_name_we_gonna_trascode_up = path.resolve(
        options.outDir,
        mp4base,
      );
      await transcodeToMp4(
        full_avi_path,
        mp4_name_we_gonna_trascode_up,
        !really_call_ffmpeg,
      );
      const pv: FfprobeData = await probeVideo(
        mp4_name_we_gonna_trascode_up,
        !really_call_ffmpeg,
      );
      audio_fp_for_whisper = mp4_name_we_gonna_trascode_up;

      video_slug = mp4base;

      for (const stream of pv.streams) {
        switch (stream.codec_type) {
          case "audio": {
            // audio_stream_for_whisper = stream;
            console.log("hmmmm do we need this audio stream?");
            break;
          }
          case "video": {
            meta.duration = parseInt(stream.duration ?? "0", 10);
            // meta.language = "df";
            video_stats_to_finally_return.duration_seconds = meta.duration;
            video_stats_to_finally_return.frames = parseInt(
              stream.nb_frames ?? "0",
              10,
            );
            break;
          }
          default: {
            throw new Error("unknown codec".concat(stream.codec_type!));
          }
        }
      }

      break;
    }
    case ".mp4": {
      throw new Error("cannot do mp4s yet");
    }
    case ".wav": {
      const mp4ForAudio = path.resolve(temporary_for_wav_work, mp4base);
      await transcodeToMp4(
        path.resolve(options.inDir, path_part.base),
        mp4ForAudio,
        !really_call_ffmpeg,
      );

      const audioProbe = await probeVideo(mp4ForAudio, !really_call_ffmpeg);

      for (const wav_audio_stream of audioProbe.streams.filter(
        (s) => s.codec_type === "audio",
      )) {
        video_stats_to_finally_return.duration_seconds = parseInt(
          wav_audio_stream.duration ?? "0",
          10,
        );
        video_slug = await create_wav_vid_return_not_justslug(
          path_part,
          options,
          video_stats_to_finally_return.duration_seconds,
        );
        audio_fp_for_whisper = mp4ForAudio;
      }

      break;
    }
    default: {
      throw new Error("unsupported media extension");
    }
  }

  if (audio_fp_for_whisper) {
    if (really_call_ffmpeg && options.transcribe) {
      const whisperTranscription: Transcription = await transcribeAudio(
        options,
        path_part,
        audio_fp_for_whisper,
      );

      const segmentJsonPath = path_part.name.concat(".vtt");
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
    } else {
      coolsole.log(
        JSON.stringify({ ff: audio_fp_for_whisper, m: "got audio" }),
      );
    }
  }

  const video: Record<string, { stats: VideoStatisticalBlock }> = {};

  const transcript = {
    meta,
    segments,
  };

  video[video_slug] = {
    stats: video_stats_to_finally_return,
  };

  return {
    transcript,
    video,
  };
}

async function generatePlaceholderVideo(
  outputMp4Path: string,
  duration: number,
  drier: boolean,
) {
  const SINGLE_FRAME_PATH = path.join(
    temporary_for_wav_work,
    "static_frame.png",
  );

  const FPS = 10; // Simple baseline frame rate to minimize encoding size output

  // console.log(
  //   "Converting source SVG layout template to a sharp PNG frame image target...",
  // );

  // 1. Convert your crisp SVG source structural code asset into a single flat PNG file target
  await sharp("./assets/no-video.svg")
    .resize(1080, 1080)
    .png()
    .toFile(SINGLE_FRAME_PATH);

  // console.log(
  //   `Starting FFmpeg stream builder workflow. Generating a ${DURATION_SECONDS}s MP4 loop file...`,
  // );

  // 2. Feed the single static image file directly into your application execution framework pipeline
  await new Promise<void>((resolve, reject) => {
    if (drier) {
      resolve();
    }
    ffmpeg()
      // Provide the single file path directly
      .input(SINGLE_FRAME_PATH)
      // CRITICAL FLAG 1: Tells FFmpeg to infinitely read/loop the single input image asset file reference
      .loop()
      // CRITICAL FLAG 2: Explicitly limits the input runtime stream loop duration match limit target
      .duration(duration)
      // Match input frame render delivery standard configurations rate pacing properties
      .inputFps(FPS)
      .output(outputMp4Path)
      // Apply scale target video filter mapping parameters directly matching size inputs
      .videoFilter(`scale=${1080}:${1080}`)
      // High efficiency modern web compliant H.264 video codec system mapping profile choice
      .videoCodec("libx264")
      // Apply constant rate quality balancing parameters (CRF 18 is visually completely lossless)
      .addOutputOption("-crf", "18")
      // Optimizes pixel depth structure arrays format configuration for universal mobile/web browser play support profiles
      .addOutputOption("-pix_fmt", "yuv420p")
      .addOutputOption("-y")
      .on("end", () => {
        // console.log("Video rendering complete successfully!");
        // Cleanup the temporary image asset frame file from the directory footprint space cleanly
        if (fs.existsSync(SINGLE_FRAME_PATH)) fs.unlinkSync(SINGLE_FRAME_PATH);
        resolve();
      })
      .on("error", (err) => {
        console.error("FFmpeg compilation process run execution failed:", err);
        reject(err);
      })
      .run();
  });
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
  parts: path.ParsedPath,
  giant_source_of_audio: string,
): Promise<Transcription> {
  const audioPath = path.resolve(
    temporary_for_wav_work,
    parts.name.concat(".mp3"),
  );

  await new Promise<void>((resolve, reject) => {
    ffmpeg(giant_source_of_audio)
      .noVideo() // 1. Completely strip the video track
      .audioCodec("libmp3lame") // 2. Use native MP3 encoding
      .audioChannels(1) // 3. Drop to mono (saves 50% file size)
      .audioBitrate("32k") // 4. Shrink size (perfect for speech Whisper)
      .outputOptions("-map_metadata -1") // 5. Strip metadata tags
      .output(audioPath)
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
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
  });

  fs.unlinkSync(audioPath);
  return result;
}

const really_call_ffmpeg = true;
const limit = Infinity;
