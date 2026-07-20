import type { FfprobeData, FfprobeStream } from "fluent-ffmpeg";

import ffmpeg from "fluent-ffmpeg";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";

import type { ProgressOptions, ProgressResult } from "../utils/meter.js";

export type AccessionWorkflowOptions = {
  dryRun: boolean;
  inDir: string;
  meter: (oo: ProgressOptions) => ProgressResult;
  // onProgress: (progress: unknown) => void;
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

type Manifest = Record<
  string,
  {
    stats: {
      "as-needed": string;
      duration_seconds: number;
      frames: number;
      "interest-score": number;
    };
    transcript: string[];
  }
>;

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

  // options.formerly_known_as_onp?.({
  //   completedFiles: 0,
  //   totalFiles: matchedFiles,
  // });

  const progress = options.meter({ max: matchedFiles });
  progress.start("starten");

  for (const filename of mediaFiles) {
    const baseName = path.parse(filename).name;
    const targetMp4 = `${baseName}.mp4`;
    const inputPath = path.join(options.inDir, filename);
    const outputVideoPath = path.join(outDir, targetMp4);

    // if (options.verbose || options.dryRun) {
    //   console.log(`Processing: ${filename} -> ${targetMp4}`);
    // }

    // if (options.dryRun) {
    //   // options.formerly_known_as_onp?.({
    //   //   completedFiles: processedFiles + failedFiles + 1,
    //   //   currentFile: filename,
    //   //   totalFiles: matchedFiles,
    //   // });
    //   continue;
    // }

    progress.advance(processedFiles + failedFiles, filename);

    try {
      await transcodeToMp4(inputPath, outputVideoPath);
      if (options.verbose) {
        console.log(`  Transcoded to ${targetMp4}`);
      }

      const metadata = await probeVideo(outputVideoPath);
      const videoStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "video",
      );
      const audioStream = metadata.streams.find(
        (stream: FfprobeStream) => stream.codec_type === "audio",
      );
      const frames = parseInt(videoStream?.nb_frames || "0", 10);
      const duration = parseFloat(metadata.format.duration?.toString() || "0");

      if (options.verbose) {
        console.log(
          `  Extracted metadata (${frames} frames, ${duration.toFixed(1)}s)`,
        );
      }

      let transcript: string | undefined;
      if (options.transcribe && audioStream && apiKey) {
        transcript = await transcribeAudio({
          apiKey,
          baseName,
          outDir,
          outputVideoPath,
        });
        transcribedFiles += 1;
        if (options.verbose) {
          const words = transcript.split(" ").filter(Boolean).length;
          console.log(`  Transcribed (${words} words)`);
        }
      } else if (options.verbose) {
        if (!options.transcribe) {
          console.log("  Skipping transcription (--transcribe not set)");
        } else if (!audioStream) {
          console.log("  No audio stream, skipping transcription");
        } else {
          console.log("  OPENAI_API_KEY not set, skipping transcription");
        }
      }

      manifest[targetMp4] = {
        stats: {
          "as-needed": "tbd",
          duration_seconds: duration,
          frames,
          "interest-score": 0.5,
        },
        transcript: transcript ? [transcript] : [],
      };

      processedFiles += 1;
      // options.formerly_known_as_onp?.({
      //   completedFiles: processedFiles + failedFiles,
      //   currentFile: filename,
      //   totalFiles: matchedFiles,
      // });
    } catch (error) {
      failedFiles += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Pipeline failure on ${filename}: ${message}`);
      // options.formerly_known_as_onp?.({
      //   completedFiles: processedFiles + failedFiles,
      //   currentFile: filename,
      //   totalFiles: matchedFiles,
      // });
    }
  }

  if (!options.dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

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
}): Promise<string> {
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

  // 2. Request VTT format
  const response = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "whisper-1",
    // response_format: "vtt", // Add this line
    response_format: "verbose_json",
  });

  // 3. Since response_format: 'vtt' returns a string,
  // you can cast it or use it directly as the VTT content
  // const vttContent = response as unknown as string;
  // console.log(response.segments?.map((s) => s.temperature));

  const vttContent = JSON.stringify(response);

  fs.unlinkSync(audioPath);

  // Return the VTT string
  return vttContent;
}
