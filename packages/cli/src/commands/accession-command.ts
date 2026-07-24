import {
  type AccessionWorkflowOptions,
  type AccessionWorkflowProgress,
  type AccessionWorkflowResult,
  color,
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

  const tone = { ...color.summaryTone };

  const rows: Array<[label: string, value: string]> = [
    ["failedFiles", String(result.failedFiles)],
    ["manifest", result.manifestPath],
    ["matched files", String(result.matchedFiles)],
    ["output dir", result.outDir],
    ["processed files", String(result.processedFiles)],
    ["transcribed files", String(result.transcribedFiles)],
  ];
  const labelWidth = rows.reduce(
    (max, [label]) => Math.max(max, label.length),
    0,
  );

  const paths = ["manifest", "output dir"];

  const prettyRows = rows.map(([label, value]) => {
    const paddedLabel = `${label.padEnd(labelWidth)}:`;
    const isPath = paths.includes(label);
    const colorizedValue = isPath ? tone.path(value) : tone.number(value);
    return `${tone.label(paddedLabel)} ${colorizedValue}`;
  });

  return [
    tone.heading("Accession stats"),
    tone.accent("-----------------------------"),
    ...prettyRows,
  ].join("\n");
}
