import { spawn } from "child_process";

// TODO reimplement
type FrameStats = {
  checksum?: string;
  mean?: number[];
  pts_time: number;
  stdev?: number[];
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

export function calculateActivityScore(
  frames: FrameStats[],
  globalMaxStdev: number,
): number {
  if (frames.length === 0) return 0;

  const uniqueChecksums = new Set(frames.map((f) => f.checksum));
  const motionRatio = uniqueChecksums.size / frames.length;

  const avgStdevY =
    frames.reduce((sum, f) => sum + (f.stdev?.[0] ?? 0), 0) / frames.length;
  const detailRatio = globalMaxStdev > 0 ? avgStdevY / globalMaxStdev : 0;

  return motionRatio * detailRatio;
}
