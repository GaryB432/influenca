export interface CliCommand<TOptions> {
  execute(input: ParsedCommandArgs<TOptions>): Promise<string>;
}

export type ParsedCommandArgs<TOptions> = {
  args: string[];
  options: TOptions;
};
