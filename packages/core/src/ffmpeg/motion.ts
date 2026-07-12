import type { FrameStats } from "@influenca/core";

import { spawn } from "child_process";

export function add(a: number, b: number): number {
  return a + b;
}
export function greet(name: string): string {
  return `motion says: hello to ${name}`;
}
export const meaning: { life: number } = {
  life: 42,
};

export function analyzeMotion(inputPath: string): Promise<{
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
