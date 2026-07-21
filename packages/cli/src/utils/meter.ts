import cliProgress from "cli-progress";

export interface ProgressOptions {
  max?: number;
  size?: number;
  style?: "block" | "heavy" | "light";
}

export interface ProgressResult {
  advance(currentValue: number, msg?: string): void;
  start(msg?: string): void;
  stop(): void;
}

export function progress({
  max = 100,
  size = 40,
  style = "block",
}: ProgressOptions): ProgressResult {
  const chars = {
    block: { complete: "\u2588", incomplete: "\u2591" },
    heavy: { complete: "\u2584", incomplete: " " },
    light: { complete: "\u2501", incomplete: "\u2500" },
  }[style];

  const bar = new cliProgress.SingleBar({
    barCompleteChar: chars.complete,
    barIncompleteChar: chars.incomplete,
    barsize: size,
    format: ` {bar} | {percentage}% | {msg}`,
    hideCursor: true,
  });

  return {
    advance: (currentValue: number, msg?: string): void => {
      // Explicitly sets the absolute current value (0 to max) directly
      bar.update(currentValue, msg ? { msg } : undefined);
    },

    start: (msg: string = "Processing"): void => {
      bar.start(max, 0, { msg });
    },

    stop: (): void => {
      bar.stop();
    },
  };
}
