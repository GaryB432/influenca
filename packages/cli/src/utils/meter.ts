export const m = 6;
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
