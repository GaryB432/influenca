import type { Manifest, VideoEntry } from "@influenca/core";

import { analyzeMotion, buildManifestFilePath } from "@influenca/core";
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { format, join, parse } from "node:path";

import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";
import type { ChildProcessWithoutNullStreams } from "child_process";

export type AscessionOptions = {
  output: string;
};

export class AscessionCommand implements CliCommand<AscessionOptions> {
  public async execute(
    input: ParsedCommandArgs<AscessionOptions>,
  ): Promise<string> {
    const [inputDir] = input.args;
    if (!inputDir) {
      throw new Error("Input directory is required.");
    }

    const { output } = input.options;
    if (!output) {
      throw new Error("Output path is required via --output.");
    }

    // Resolve tilde in inputDir if present
    const resolvedInputDir = inputDir.startsWith("~")
      ? inputDir.replace("~", process.env.HOME || "")
      : inputDir;

    // Create output directory if it doesn't exist
    mkdirSync(output, { recursive: true });

    const mediaExtenstions = [".avi", ".mp4"];

    const manifest: Manifest = {};
    const manifestPath = buildManifestFilePath(output);

    const workload = readdirSync(resolvedInputDir)
      .map((f) => parse(f))
      .filter((f) => mediaExtenstions.includes(f.ext.toLowerCase()));

    for (const w of workload) {
      const inputPath = join(resolvedInputDir, w.base);
      const outputFileName = format({ ext: ".mp4", name: w.name });
      const outputPath = join(output, outputFileName);
      console.log(JSON.stringify({ inputPath, outputPath }));
      console.log(`Converting ${w.base} -> ${outputFileName}...`);

      manifest[outputFileName] = await new Promise((resolve) => {
        const stats: VideoEntry = {
          "encoding-stats": {
            bitrate: "N/A",
            fps: 0,
            frames: 0,
            total_size: 0,
          },
        };

        const ffmpeg = spawn(
          "ffmpeg",
          buildFFmpegOptions(inputPath, outputPath),
        );

        // Parse stderr where ffmpeg writes its progress
        parseFfmpegStats(ffmpeg, stats);

        ffmpeg.on("close", async (code) => {
          if (code === 0) {
            console.log(`  ✓ Converted successfully`);
            // Capture raw frame data after conversion
            console.log(`  📊 Sampling frames...`);
            const motion = await analyzeMotion(outputPath);
            stats["frame-samples"] = {
              frames: motion.frames,
              sample_interval_seconds: 0.5,
            };
          } else {
            console.error(`  ✗ Conversion failed with code ${code}`);
          }
          resolve(stats);
        });

        ffmpeg.on("error", (error) => {
          console.error(`  ✗ Failed to spawn ffmpeg:`, error);
          resolve(stats);
        });
      });
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return `Processed ${workload.length} files. Manifest saved to ${manifestPath}`;
  }
}

function parseFfmpegStats(
  ffmpeg: ChildProcessWithoutNullStreams,
  stats: VideoEntry,
) {
  ffmpeg.stderr.on("data", (data) => {
    const output = data.toString();

    // Parse frame=X pattern
    const frameMatch = output.match(/frame=\s*(\d+)/);
    if (frameMatch) {
      stats["encoding-stats"].frames = parseInt(frameMatch[1]);
    }

    // Parse fps=X pattern
    const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);
    if (fpsMatch) {
      stats["encoding-stats"].fps = parseFloat(fpsMatch[1]);
    }

    // Parse bitrate pattern
    const bitrateMatch = output.match(/bitrate=\s*(\d+\.?\d*[a-zA-Z]+)/);
    if (bitrateMatch) {
      stats["encoding-stats"].bitrate = bitrateMatch[1];
    }
  });
}

// Use a high quality, fast preset: libx264, fast preset, crf 23 (standard quality)
function buildFFmpegOptions(
  inputPath: string,
  outputPath: string,
): readonly string[] | undefined {
  return [
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
    "-y",
  ];
}
