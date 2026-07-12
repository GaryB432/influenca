import {
  buildManifestFilePath,
  calculateActivityScore,
  type Manifest,
} from "@influenca/core";
import { readFileSync } from "node:fs";

import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type AnalyzeOptions = {
  threshold?: number;
};

export class AnalyzeCommand implements CliCommand<AnalyzeOptions> {
  public async execute(
    input: ParsedCommandArgs<AnalyzeOptions>,
  ): Promise<string> {
    const [inputDir] = input.args;
    if (!inputDir) {
      throw new Error("Input directory is required.");
    }

    const manifestPath = buildManifestFilePath(inputDir);
    const data = readFileSync(manifestPath, "utf-8");
    const manifest: Manifest = JSON.parse(data);

    const videos = Object.keys(manifest);
    if (videos.length === 0) {
      return "No videos found in the manifest.";
    }

    // 1. Determine Global Max Y-Stdev for normalization
    let globalMaxStdev = 0;
    for (const video of videos) {
      const frames = manifest[video]["frame-samples"]?.frames ?? [];
      for (const frame of frames) {
        const stdevY = frame.stdev?.[0] ?? 0;
        if (stdevY > globalMaxStdev) {
          globalMaxStdev = stdevY;
        }
      }
    }

    let summary = `\n📊 Manifest Summary for ${inputDir}\n`;
    summary += "=".repeat(50) + "\n";
    summary += `${"Video".padEnd(20)} | ${"Score".padEnd(8)} | ${"Status"}\n`;
    summary += "-".repeat(50) + "\n";

    const threshold = input.options.threshold ?? -1;

    for (const video of videos) {
      const videoData = manifest[video];
      const frames = videoData["frame-samples"]?.frames ?? [];
      const score = calculateActivityScore(frames, globalMaxStdev);

      const scorePct = (score * 100).toFixed(1) + "%";
      const isBoring = threshold >= 0 && score < threshold;
      const status = isBoring ? "[BORING] 🗑️" : "✅";

      summary += `${video.padEnd(20)} | ${scorePct.padEnd(8)} | ${status}\n`;
    }

    summary += "=".repeat(50) + "\n";
    summary += `Total Videos: ${videos.length}\n`;
    if (threshold >= 0) {
      summary += `Filtering threshold: ${threshold}\n`;
    }

    return summary;
  }
}
