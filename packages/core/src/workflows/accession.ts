import type { FfprobeData, FfprobeStream } from "fluent-ffmpeg";

import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";

import type {
  Manifest,
  ProgressOptions,
  ProgressResult,
  Transcription,
  TranscriptionSegment,
  VideoEntry,
} from "../index.js";

import * as color from "../color.js";
import * as finny from "../shims/fs.js";

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
  if (!options.outDir) {
    throw new Error("outDir is required.");
  }

  const outDir = options.outDir;
  const manifestPath = path.join(outDir, ".influenca.json");
  const apiKey = options.openAiKey;
  const files = fs.readdirSync(options.inDir);
  // const so_many_mediaFiles = files.filter((filename) => {
  //   return filename.toLowerCase().match(/\.(avi|mp4)$/);
  // });
  const doffmpeg = false;
  const limit = 5;

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

  for (const partThepart of media_parts) {
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

    const inputPath = path.join(options.inDir, path.format(partThepart));
    const tmp4 = partThepart.name.concat(".mp4");
    const ovp = path.join(options.outDir, tmp4);

    try {
      await transcodeToMp4(inputPath, ovp, !doffmpeg);
      // if (options.verbose) {
      //   console.log(`  Transcoded to ${targetMp4}`);
      // }

      const metadata = await probeVideo(ovp, !doffmpeg);
      const videoStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "video",
      );
      const audioStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "audio",
      );
      const frames = parseInt(videoStream?.nb_frames || "0", 10);
      const duration = parseFloat(metadata.format.duration?.toString() || "0");

      // if (options.verbose) {
      //   console.log(
      //     `  Extracted metadata (${frames} frames, ${duration.toFixed(1)}s)`,
      //   );
      // }

      let whisperTranscription: Transcription | undefined;
      if (!doffmpeg || (options.transcribe && audioStream && apiKey)) {
        whisperTranscription = await transcribeAudio(
          {
            apiKey,
            baseName: partThepart.name,
            outDir,
            outputVideoPath: ovp,
          },
          !doffmpeg,
        );
        transcribedFiles += 1;
      } else if (options.verbose) {
        // if (!options.transcribe) {
        //   console.log("  Skipping transcription (--transcribe not set)");
        // } else if (!audioStream) {
        //   console.log("  No audio stream, skipping transcription");
        // } else {
        //   console.log("  OPENAI_API_KEY not set, skipping transcription");
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
        const segmentJsonPath = partThepart.name.concat(".vtt.json");
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

        finny.writeJSONSync<TranscriptionSegment[]>(
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

      manifest[partThepart.name] = videoEntry;

      processedFiles += 1;
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      // progress.message('nope')
    }
    progress.advance(
      processedFiles + failedFiles,
      `${partThepart.base} was just completed`,
    );
  }

  if (!options.dryRun) {
    finny.writeJSONSync<Manifest>(manifestPath, manifest, {
      stringify: { replacer: null, space: 2 },
    });
    // finny.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  progress.stop();
  console.log(manifestPath, "wuz jes wrote");

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
      console.log("probeVideo");
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
      console.log(
        JSON.stringify({
          m: "transcodeToMp4",
          inputPath,
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
      console.log("transcribeAudio");
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
