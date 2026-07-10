import { buildGreetingMessage } from "@influenca/core";

import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type GreetOptions = {
  offsetHours: number;
};

export class GreetCommand implements CliCommand<GreetOptions> {
  public async execute(
    input: ParsedCommandArgs<GreetOptions>,
  ): Promise<string> {
    const [name] = input.args;
    if (!name) {
      throw new Error("Name is required.");
    }

    const greeting = buildGreetingMessage({
      name,
      offsetHours: input.options.offsetHours,
    });

    if (!greeting.ok) {
      throw new Error(greeting.issues.join(" "));
    }

    return greeting.value;
  }
}
