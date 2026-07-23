import {
  type AccessionWorkflowOptions,
  type AccessionWorkflowProgress,
  type AccessionWorkflowResult,
  runAccessionWorkflow,
} from "@influenca/core";

import {
  type CliCommand,
  type CommandRuntime,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type AccessionCommandOptions = {
  dryRun: boolean;
  openAiKey: string;
  outDir: string;
  transcribe: boolean;
  verbose: boolean;
};

export type AccessionCommandRuntime = CommandRuntime<AccessionWorkflowProgress>;

export class AccessionCommand implements CliCommand<
  AccessionCommandOptions,
  AccessionWorkflowProgress
> {
  public async execute(
    input: ParsedCommandArgs<AccessionCommandOptions>,
    runtime: AccessionCommandRuntime,
  ): Promise<string> {
    const [inDir] = input.args;

    if (!inDir) {
      throw new Error("inDir is required.");
    }

    const accessionOptions: AccessionWorkflowOptions = {
      ...input.options,
      inDir,
      meter: runtime.meter,
      // onProgress: function (): void {
      //   throw new Error("Function not implemented.");
      // },
    };
    const result = await runAccessionWorkflow(accessionOptions);

    return formatSummary(result, input.options.dryRun);
  }
}

function formatSummary(
  result: AccessionWorkflowResult,
  dryRun: boolean,
): string {
  if (dryRun) {
    return `Dry run complete: matched ${result.matchedFiles} file(s) in ${result.outDir}.`;
  }

  return `Accession complete: processed ${result.processedFiles}/${result.matchedFiles}, transcribed ${result.transcribedFiles}, failed ${result.failedFiles}. Manifest: ${result.manifestPath}`;
}
