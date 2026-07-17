import type { Manifest, VideoEntry } from "@influenca/core";

import { analyzeMotion } from "@influenca/core";
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type AscessionOptions = {
  output: string;
};

type AccessionDependencies = {
  analyzeMotion: typeof analyzeMotion;
  error: (...data: unknown[]) => void;
  log: (...data: unknown[]) => void;
  mkdirSync: (path: string, options: { recursive: true }) => void;
  readdirSync: (path: string) => string[];
  spawn: (command: string, args: string[]) => AccessionProcess;
  writeFileSync: (path: string, data: string) => void;
};

type AccessionProcess = {
  on(event: "close", listener: (code: null | number) => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  stderr: {
    on(event: "data", listener: (data: Buffer | string) => void): void;
  };
};

const defaultDependencies: AccessionDependencies = {
  analyzeMotion,
  error: console.error,
  log: console.log,
  mkdirSync,
  readdirSync,
  spawn,
  writeFileSync,
};

export class AscessionCommand implements CliCommand<AscessionOptions> {
  private readonly dependencies: AccessionDependencies;

  public constructor(dependencies: AccessionDependencies = defaultDependencies) {
    this.dependencies = dependencies;
  }

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

    const files = this.dependencies.readdirSync(resolvedInputDir).filter((f) =>
      f.toLowerCase().endsWith(".avi"),
    );

    if (files.length === 0) {
      return `No AVI files found in ${resolvedInputDir}`;
    }

    // Create output directory if it doesn't exist
    this.dependencies.mkdirSync(output, { recursive: true });

    const manifest: Manifest = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = join(output, `videos-${timestamp}.json`);

    for (const [index, file] of files.entries()) {
      const inputPath = join(resolvedInputDir, file);
      const outputFileName =
        file.replace(/\.[^.]+$/, "").toLowerCase() + ".mp4";
      const outputPath = join(output, outputFileName);
      const progress = formatAccessionProgress(index, files.length);

      this.dependencies.log(
        `${progress} Converting ${file} -> ${outputFileName}...`,
      );

      manifest[file] = await new Promise((resolve) => {
        const stats: VideoEntry = {
          "encoding-stats": {
            bitrate: "N/A",
            fps: 0,
            frames: 0,
            total_size: 0,
          },
        };

        // Use a high quality, fast preset: libx264, fast preset, crf 23 (standard quality)
        const ffmpeg = this.dependencies.spawn("ffmpeg", [
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
        ]);

        // Parse stderr where ffmpeg writes its progress
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

        ffmpeg.on("close", async (code) => {
          if (code === 0) {
            this.dependencies.log(`${progress} ✓ Converted successfully`);
            // Capture raw frame data after conversion
            this.dependencies.log(`${progress} 📊 Sampling frames...`);
            const motion = await this.dependencies.analyzeMotion(outputPath);
            stats["frame-samples"] = {
              frames: motion.frames,
              sample_interval_seconds: 0.5,
            };
          } else {
            this.dependencies.error(
              `${progress} ✗ Conversion failed with code ${code}`,
            );
          }
          resolve(stats);
        });

        ffmpeg.on("error", (error) => {
          this.dependencies.error(
            `${progress} ✗ Failed to spawn ffmpeg:`,
            error,
          );
          resolve(stats);
        });
      });
    }

    this.dependencies.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2),
    );

    return `Processed ${files.length} files. Manifest saved to ${manifestPath}`;
  }
}

export function formatAccessionProgress(
  currentFileIndex: number,
  totalFiles: number,
): string {
  return `[${currentFileIndex + 1}/${totalFiles}]`;
}
