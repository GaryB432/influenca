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
  VideoEntry,
} from "../index.js";

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

import * as color from "../color.js";

export type AccessionWorkflowResult = {
  failedFiles: number;
  manifestPath: string;
  matchedFiles: number;
  outDir: string;
  processedFiles: number;
  transcribedFiles: number;
};

// export interface ProgressOptions {
//   max?: number;
//   size?: number;
//   style?: "block" | "heavy" | "light";
// }

// export interface ProgressResult {
//   advance(currentValue: number, msg?: string): void;
//   start(msg?: string): void;
//   stop(): void;
// }

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
  const mediaFiles = files.filter((filename) => {
    return filename.toLowerCase().match(/\.(avi|mp4)$/);
  });
  const manifest: Manifest = {};

  if (!options.dryRun && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let failedFiles = 0;
  const matchedFiles = mediaFiles.length;
  let processedFiles = 0;
  let transcribedFiles = 0;

  const progress = options.meter({ max: matchedFiles });
  progress.start(color.summaryTone.path(options.outDir));

  for (const filename of mediaFiles) {
    const baseName = path.parse(filename).name;
    const targetMp4 = `${baseName}.mp4`;
    const inputPath = path.join(options.inDir, filename);
    const outputVideoPath = path.join(outDir, targetMp4);

    const trackBaseName = `${baseName}.track.json`;
    try {
      await transcodeToMp4(inputPath, outputVideoPath);
      // if (options.verbose) {
      //   console.log(`  Transcoded to ${targetMp4}`);
      // }

      const metadata = await probeVideo(outputVideoPath);
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
      if (options.transcribe && audioStream && apiKey) {
        whisperTranscription = await transcribeAudio({
          apiKey,
          baseName,
          outDir,
          outputVideoPath,
        });
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
        stats: {
          duration_seconds: duration,
          frames,
        },
        transcript: undefined,
      };

      if (whisperTranscription) {
        const outputSegmentsPath = path.join(outDir, trackBaseName);

        fs.writeFileSync(
          outputSegmentsPath,
          JSON.stringify(whisperTranscription.segments, undefined, 2),
        );

        videoEntry.transcript = {
          meta: {
            duration: whisperTranscription.duration,
            language: whisperTranscription.language,
          },
          segments: trackBaseName,
        };
      }

      manifest[targetMp4] = videoEntry;

      processedFiles += 1;
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      // progress.message('nope')
    }
    progress.advance(
      processedFiles + failedFiles,
      `${filename} was just completed`,
    );
  }

  if (!options.dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  progress.stop();
  console.log(manifestPath, "you used to be mine");

  return {
    failedFiles,
    manifestPath,
    matchedFiles,
    outDir,
    processedFiles,
    transcribedFiles,
  };
}

async function probeVideo(videoPath: string): Promise<FfprobeData> {
  return new Promise<FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}

async function transcodeToMp4(inputPath: string, outputVideoPath: string) {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputVideoPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions("-crf", "23", "-preset", "fast")
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

async function transcribeAudio(options: {
  apiKey: string;
  baseName: string;
  outDir: string;
  outputVideoPath: string;
}): Promise<Transcription> {
  const openai = new OpenAI({ apiKey: options.apiKey });
  const audioPath = path.join(options.outDir, `${options.baseName}.m4a`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(options.outputVideoPath)
      .noVideo()
      .audioCodec("aac")
      .output(audioPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });

  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
  });

  fs.unlinkSync(audioPath);

  return response;
}
