import type { FfprobeData, FfprobeStream } from "fluent-ffmpeg";

import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";

const console_wrapper = {
  error(...s: string[]) {
    console.error(s);
  },
  log(...s: string[]) {
    console.log(s);
  },
};

import type {
  Manifest,
  ProgressOptions,
  ProgressResult,
  Transcription,
  TranscriptionSegment,
  VideoEntry,
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

export async function runAccessionWorkflow(
  options: AccessionWorkflowOptions,
): Promise<AccessionWorkflowResult> {
  if (options.verbose) {
    throw new Error("verbosity is a matter for the terminal layer");
  }
  if (!options.outDir) {
    throw new Error("outDir is required.");
  }

  const outDir = options.outDir;
  const manifestPath = path.join(outDir, ".influenca.json");
  const apiKey = options.openAiKey;
  const files = fs.readdirSync(options.inDir);

  const every_media_parts = files
    .map((f) => path.parse(f))
    .filter((p) => p.ext.toLowerCase().match(/\.(avi|mp4)$/));

  const media_parts = every_media_parts.slice(0, limit);

  const manifest: Manifest = {};

  if (!options.dryRun && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let failedFiles = 0;
  const matchedFiles = media_parts.length;
  let processedFiles = 0;
  let transcribedFiles = 0;

  const progress = options.meter({ max: matchedFiles });
  progress.start(color.summaryTone.path(options.outDir));

  for (const path_part of media_parts) {
    // const f = {
    //   filename: "VID00000.AVI",
    //   partThepart: {
    //     base: "VID00000.AVI",
    //     dir: "",
    //     ext: ".AVI",
    //     name: "VID00000",
    //     root: "",
    //   },
    // };

    const inputPath = path.join(options.inDir, path.format(path_part));
    const tmp4 = path_part.name.concat(".mp4");
    const ovp = path.join(options.outDir, tmp4);

    try {
      await transcodeToMp4(inputPath, ovp, !really_call_ffmpeg);

      const metadata = await probeVideo(ovp, !really_call_ffmpeg);
      const videoStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "video",
      );
      // TODO are we duplicating audio? for whisper later?
      const audioStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "audio",
      );
      const frames = parseInt(videoStream?.nb_frames || "0", 10);
      const duration = parseFloat(metadata.format.duration?.toString() || "0");

      let whisperTranscription: Transcription | undefined;
      if (
        !really_call_ffmpeg ||
        (options.transcribe && audioStream && apiKey)
      ) {
        whisperTranscription = await transcribeAudio(
          {
            apiKey,
            baseName: path_part.name,
            outDir,
            outputVideoPath: ovp,
          },
          !really_call_ffmpeg,
        );
        transcribedFiles += 1;
      } else if (options.verbose) {
        // if (!options.transcribe) {
        //   dont_use_the_console.log("  Skipping transcription (--transcribe not set)");
        // } else if (!audioStream) {
        //   dont_use_the_console.log("  No audio stream, skipping transcription");
        // } else {
        //   dont_use_the_console.log("  OPENAI_API_KEY not set, skipping transcription");
        // }
      }

      const videoEntry: VideoEntry = {
        transcript: undefined,

        video: {
          [tmp4]: {
            stats: {
              duration_seconds: duration,
              frames,
            },
          },
        },
      };

      if (whisperTranscription) {
        const segmentJsonPath = path_part.name.concat(".vtt");
        const outputSegmentsPath = path.join(outDir, segmentJsonPath);

        const blank_segment_for_fun: TranscriptionSegment = {
          avg_logprob: 0,
          compression_ratio: 0,
          end: 5,
          id: 0,
          no_speech_prob: 0,
          seek: 0,
          start: 0,
          temperature: 0,
          text: "NOTHING TO HEAR HERE",
          tokens: [3, 5, 7, 9],
        };

        writeJSONSync<TranscriptionSegment[]>(
          outputSegmentsPath,
          whisperTranscription.segments ?? [blank_segment_for_fun],
          {
            stringify: { replacer: null, space: 2 },
          },
        );

        videoEntry.transcript = {
          meta: {
            duration: whisperTranscription.duration,
            language: whisperTranscription.language,
          },
          segments: segmentJsonPath,
        };
      }

      manifest[path_part.name] = videoEntry;

      processedFiles += 1;
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      console_wrapper.error(message);
      // progress.message('nope')
    }
    progress.advance(
      processedFiles + failedFiles,
      `${path_part.base} was just completed`,
    );
  }

  if (!options.dryRun) {
    writeJSONSync<Manifest>(manifestPath, manifest, {
      stringify: { replacer: null, space: 2 },
    });
    // finny.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
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

async function probeVideo(
  videoPath: string,
  drier: boolean,
): Promise<FfprobeData> {
  return new Promise<FfprobeData>((resolve, reject) => {
    if (drier) {
      console_wrapper.log("probeVideo");
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
      console_wrapper.log(
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
  options: {
    apiKey: string;
    baseName: string;
    outDir: string;
    outputVideoPath: string;
  },
  drier: boolean,
): Promise<Transcription> {
  const openai = new OpenAI({ apiKey: options.apiKey });
  const audioPath = path.join(options.outDir, `${options.baseName}.m4a`);

  let result: Transcription = {
    duration: 2.4,
    language: "english",
    text: "I WAS SKIPPED",
  };

  await new Promise<void>((resolve, reject) => {
    if (drier) {
      console_wrapper.log("transcribeAudio");
      setTimeout(() => {
        resolve();
      }, 100);
    } else {
      ffmpeg(options.outputVideoPath)
        .noVideo()
        .audioCodec("aac")
        .output(audioPath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    }
  });

  if (!drier) {
    result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json",
    });
    fs.unlinkSync(audioPath);
  }
  return result;
}

const really_call_ffmpeg = true;
const limit = Infinity;
