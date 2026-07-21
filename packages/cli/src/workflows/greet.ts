import type { CommandRuntime } from "../command-contract.js";

import { progress } from "../utils/meter.js";

export type GreetWorkflowOptions = {
  interactive: boolean;
  offset: number | string;
};

export type GreetWorkflowProgress = {
  phase: "completed" | "started";
};

export async function runGreet(
  name: string | undefined,
  options: GreetWorkflowOptions,
  runtime: CommandRuntime<GreetWorkflowProgress> = {
    meter: progress,
    onProgress: noopProgress,
  },
): Promise<void> {
  runtime.onProgress?.({ phase: "started" });

  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(JSON.stringify({ name, options }));
      runtime.onProgress?.({ phase: "completed" });
      resolve();
    }, 1000);
  });
}

function noopProgress(): void {
  // Intentionally empty default progress handler.
}
