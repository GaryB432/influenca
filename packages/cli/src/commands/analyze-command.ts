import { color } from "@influenca/core";

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

type AnalyzeSummaryTone = {
  accent: (value: string) => string;
  heading: (value: string) => string;
  label: (value: string) => string;
  number: (value: string) => string;
  path: (value: string) => string;
};

const { ansiBold, ansiReset, color256, supportsModernColors } = color;

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

function createAnalyzeSummaryTone(): AnalyzeSummaryTone {
  if (!supportsModernColors()) {
    return {
      accent: identity,
      heading: identity,
      label: identity,
      number: identity,
      path: identity,
    };
  }

  return {
    accent: (value) => color256(147, value),
    heading: (value) => `${ansiBold()}${color256(177, value)}${ansiReset()}`,
    label: (value) => color256(81, value),
    number: (value) => color256(221, value),
    path: (value) => color256(121, value),
  };
}

function formatAnalyzeSummary(
  result: AnalyzeWorkflowResult,
  minimal: boolean,
): string {
  const tone = createAnalyzeSummaryTone();

  if (minimal) {
    return [
      tone.heading("Analyze minimal"),
      `${tone.label("videos:")} ${tone.number(String(result.videoCount))}`,
      `${tone.label("manifest:")} ${tone.path(result.manifestPath)}`,
    ].join("\n");
  }

  const missingStatsCount = result.videoCount - result.withStatsCount;
  const averageDurationSeconds =
    result.withStatsCount > 0
      ? result.totalDurationSeconds / result.withStatsCount
      : 0;
  const averageFrames =
    result.withStatsCount > 0 ? result.totalFrames / result.withStatsCount : 0;

  const rows: Array<[label: string, value: string]> = [
    ["manifest", result.manifestPath],
    ["videos", String(result.videoCount)],
    ["with stats", String(result.withStatsCount)],
    ["missing stats", String(missingStatsCount)],
    ["total duration (s)", result.totalDurationSeconds.toFixed(2)],
    ["total frames", String(result.totalFrames)],
    ["avg duration per video (s)", averageDurationSeconds.toFixed(2)],
    ["avg frames per video", averageFrames.toFixed(2)],
  ];
  const labelWidth = rows.reduce(
    (max, [label]) => Math.max(max, label.length),
    0,
  );

  const prettyRows = rows.map(([label, value]) => {
    const paddedLabel = `${label.padEnd(labelWidth)}:`;
    const isPath = label === "manifest";
    const colorizedValue = isPath ? tone.path(value) : tone.number(value);
    return `${tone.label(paddedLabel)} ${colorizedValue}`;
  });

  return [
    tone.heading("Analyze stats"),
    tone.accent("-----------------------------"),
    ...prettyRows,
  ].join("\n");
}

function identity(value: string): string {
  return value;
}
