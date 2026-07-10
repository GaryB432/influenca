import { spawn } from "node:child_process";
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type AscessionOptions = {
  output: string;
};

type FrameStats = {
  pts_time: number;
  checksum: string;
  mean: number[];
  stdev: number[];
};

function analyzeMotion(inputPath: string): Promise<{
  frames: FrameStats[];
}> {
  return new Promise((resolve) => {
    const frames: FrameStats[] = [];
    let currentFrame: Partial<FrameStats> = {};

    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputPath,
      "-vf",
      "select='isnan(prev_selected_t)+gte(t,prev_selected_t+0.5)',showinfo",
      "-f",
      "null",
      "-",
    ]);

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      const lines = output.split("\n");

      for (const line of lines) {
        // Parse pts_time
        if (line.includes("pts_time:")) {
          const match = line.match(/pts_time:([\d.]+)/);
          if (match) {
            currentFrame.pts_time = parseFloat(match[1]);
          }
        }

        // Parse checksum
        if (line.includes("checksum:")) {
          const match = line.match(/checksum:([A-F0-9]+)/);
          if (match) {
            currentFrame.checksum = match[1];
          }
        }

        // Parse mean values (Y, U, V)
        if (line.includes("mean:")) {
          const match = line.match(/mean:\[([\d.]+)\s+([\d.]+)\s+([\d.]+)\]/);
          if (match) {
            currentFrame.mean = [
              parseFloat(match[1]),
              parseFloat(match[2]),
              parseFloat(match[3]),
            ];
          }
        }

        // Parse stdev values (Y, U, V)
        if (line.includes("stdev:")) {
          const match = line.match(/stdev:\[([\d.]+)\s+([\d.]+)\s+([\d.]+)\]/);
          if (match) {
            currentFrame.stdev = [
              parseFloat(match[1]),
              parseFloat(match[2]),
              parseFloat(match[3]),
            ];
            // Frame is complete, push it
            if (currentFrame.pts_time !== undefined && currentFrame.checksum) {
              frames.push(currentFrame as FrameStats);
              currentFrame = {};
            }
          }
        }
      }
    });

    ffmpeg.on("close", () => {
      resolve({
        frames,
      });
    });

    ffmpeg.on("error", () => {
      resolve({
        frames: [],
      });
    });
  });
}

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

    const files = readdirSync(resolvedInputDir).filter((f) =>
      f.toLowerCase().endsWith(".avi"),
    );

    if (files.length === 0) {
      return `No AVI files found in ${resolvedInputDir}`;
    }

    // Create output directory if it doesn't exist
    mkdirSync(output, { recursive: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manifest: Record<string, any> = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = join(output, `videos-${timestamp}.json`);

    for (const file of files) {
      const inputPath = join(resolvedInputDir, file);
      const outputFileName =
        file.replace(/\.[^.]+$/, "").toLowerCase() + ".mp4";
      const outputPath = join(output, outputFileName);

      console.log(`Converting ${file} -> ${outputFileName}...`);

      manifest[file] = await new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stats: Record<string, any> = {
          "encoding-stats": {
            frames: 0,
            fps: 0,
            bitrate: "N/A",
            total_size: 0,
          },
        };

        // Use a high quality, fast preset: libx264, fast preset, crf 23 (standard quality)
        const ffmpeg = spawn("ffmpeg", [
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
            stats["encoding-stats"]["frames"] = parseInt(frameMatch[1]);
          }

          // Parse fps=X pattern
          const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);
          if (fpsMatch) {
            stats["encoding-stats"]["fps"] = parseFloat(fpsMatch[1]);
          }

          // Parse bitrate pattern
          const bitrateMatch = output.match(/bitrate=\s*(\d+\.?\d*[a-zA-Z]+)/);
          if (bitrateMatch) {
            stats["encoding-stats"]["bitrate"] = bitrateMatch[1];
          }
        });

        ffmpeg.on("close", async (code) => {
          if (code === 0) {
            console.log(`  ✓ Converted successfully`);
            // Capture raw frame data after conversion
            console.log(`  📊 Sampling frames...`);
            const motion = await analyzeMotion(outputPath);
            stats["frame-samples"] = {
              sample_interval_seconds: 0.5,
              frames: motion.frames,
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

    return `Processed ${files.length} files. Manifest saved to ${manifestPath}`;
  }
}
