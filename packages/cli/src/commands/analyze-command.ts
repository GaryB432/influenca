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

  return `Analyze stats: videos=${result.videoCount}, with-stats=${result.withStatsCount}, total-frames=${result.totalFrames}, total-duration-seconds=${result.totalDurationSeconds.toFixed(2)} (${result.manifestPath})`;
}
