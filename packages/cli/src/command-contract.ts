import type { ProgressOptions, ProgressResult } from "./utils/meter.js";

export interface CliCommand<TOptions, TProgress = never> {
  execute(
    input: ParsedCommandArgs<TOptions>,
    runtime: CommandRuntime<TProgress>,
  ): Promise<string>;
}

export type CommandRuntime<TProgress = never> = {
  meter: (o: ProgressOptions) => ProgressResult;
  onProgress: (progress: TProgress) => void;
};

export type ParsedCommandArgs<TOptions> = {
  args: string[];
  options: TOptions;
};
