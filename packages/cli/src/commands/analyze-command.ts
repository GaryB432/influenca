import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type AnalyzeOptions = { tbd?: boolean | undefined };

export class AnalyzeCommand implements CliCommand<AnalyzeOptions> {
  public async execute(
    input: ParsedCommandArgs<AnalyzeOptions>,
  ): Promise<string> {
    const [inputDir] = input.args;
    if (!inputDir) {
      throw new Error("Input directory is required.");
    }

    const manifestPath = join(inputDir, "influenca.json");
    const data = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(data);

    const videos = Object.keys(manifest);
    if (videos.length === 0) {
      return "No videos found in the manifest.";
    }

    let summary = `\n📊 Manifest Summary for ${inputDir}\n`;
    summary += "=".repeat(40) + "\n";

    for (const video of videos) {
      const videoData = manifest[video];
      const samplesCount = videoData["frame-samples"]?.frames?.length ?? 0;
      summary += `${video}: ${samplesCount} samples\n`;
    }

    summary += "=".repeat(40) + "\n";
    summary += `Total Videos: ${videos.length}\n`;

    return summary;
  }
}
