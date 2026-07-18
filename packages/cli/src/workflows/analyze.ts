// import { VideoEntry } from "@influenca/core";
import { parseManifest } from "@influenca/core";
import fs from "node:fs";
import path from "node:path";

export type AnalyzeWorkflowOptions = {
  inDir: string;
  minimal: boolean;
};

export type AnalyzeWorkflowResult = {
  manifestPath: string;
  totalDurationSeconds: number;
  totalFrames: number;
  videoCount: number;
  withStatsCount: number;
};

export async function runAnalyzeWorkflow(
  options: AnalyzeWorkflowOptions,
): Promise<AnalyzeWorkflowResult> {
  const manifestPath = path.join(options.inDir, ".influenca.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest found at ${manifestPath}.`);
  }

  const rawManifest = fs.readFileSync(manifestPath, "utf8");
  const manifest = parseManifest(rawManifest);
  const entries = Object.values(manifest);

  let totalDurationSeconds = 0;
  let totalFrames = 0;
  let withStatsCount = 0;

  for (const entry of entries) {
    const stats = entry.stats;
    if (!stats) {
      continue;
    }

    withStatsCount += 1;
    totalDurationSeconds += stats.duration_seconds ?? 0;
    totalFrames += Math.trunc(stats.frames ?? 0);
  }

  return {
    manifestPath,
    totalDurationSeconds,
    totalFrames,
    videoCount: entries.length,
    withStatsCount,
  };
}
