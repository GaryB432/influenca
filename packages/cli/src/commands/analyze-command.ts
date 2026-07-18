import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";
import {
  type AnalyzeWorkflowResult,
  runAnalyzeWorkflow,
} from "../workflows/analyze.js";

export type AnalyzeCommandOptions = {
  minimal: boolean;
};

export class AnalyzeCommand implements CliCommand<AnalyzeCommandOptions> {
  public async execute(
    input: ParsedCommandArgs<AnalyzeCommandOptions>,
  ): Promise<string> {
    const [inDir] = input.args;

    if (!inDir) {
      throw new Error("inDir is required.");
    }

    const result = await runAnalyzeWorkflow({
      inDir,
      minimal: input.options.minimal,
    });

    return formatAnalyzeSummary(result, input.options.minimal);
  }
}

function formatAnalyzeSummary(
  result: AnalyzeWorkflowResult,
  minimal: boolean,
): string {
  if (minimal) {
    return `Analyze minimal: ${result.videoCount} video(s) listed in ${result.manifestPath}.`;
  }

  const missingStatsCount = result.videoCount - result.withStatsCount;
  const averageDurationSeconds =
    result.withStatsCount > 0
      ? result.totalDurationSeconds / result.withStatsCount
      : 0;
  const averageFrames =
    result.withStatsCount > 0 ? result.totalFrames / result.withStatsCount : 0;

  return [
    "Analyze stats",
    `- manifest: ${result.manifestPath}`,
    `- videos: ${result.videoCount}`,
    `- with stats: ${result.withStatsCount}`,
    `- missing stats: ${missingStatsCount}`,
    `- total duration (s): ${result.totalDurationSeconds.toFixed(2)}`,
    `- total frames: ${result.totalFrames}`,
    `- avg duration per video (s): ${averageDurationSeconds.toFixed(2)}`,
    `- avg frames per video: ${averageFrames.toFixed(2)}`,
  ].join("\n");
}
