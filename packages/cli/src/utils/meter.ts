import cliProgress from "cli-progress";

export interface ProgressOptions {
  max?: number;
  size?: number;
  style?: "block" | "heavy" | "light";
}
export interface ProgressResult extends SpinnerResult {
  advance(step?: number, msg?: string): void;
}
interface SpinnerResult {
  cancel(msg?: string): void;
  clear(): void;
  error(msg?: string): void;
  readonly isCancelled: boolean;
  message(msg?: string): void;
  start(msg?: string): void;
  stop(msg?: string): void;
}

// // create a new progress bar instance and use shades_classic theme
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

// // start the progress bar with a total value of 200 and start value of 0
// bar1.start(200, 0);

// // update the current value in your application..
// bar1.update(100);

// // stop the progress bar
// bar1.stop();

export function progress({
  style,
  max,
  size,
}: ProgressOptions): ProgressResult {
  return {
    advance: (step: number, msg?: string): void => {
      bar1.update(step);
    },
    cancel: function (msg?: string): void {
      throw new Error("Function not implemented.");
    },
    clear: function (): void {
      throw new Error("Function not implemented.");
    },
    error: function (msg?: string): void {
      throw new Error("Function not implemented.");
    },
    isCancelled: false,
    message: function (msg?: string): void {
      throw new Error("Function not implemented.");
    },
    start: (msg?: string): void => {
      bar1.start(max ?? 0, 0);
    },
    stop: function (msg?: string): void {
      bar1.stop();
    },
  };
}
