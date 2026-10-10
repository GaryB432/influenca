import { styleText } from "node:util";

const format = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const stream = (
  method: "error" | "log" | "warn",
  style: Parameters<typeof styleText>[0],
  ...values: unknown[]
): void => {
  const message = values.map(format).join(" ");
  const rendered = styleText(style, message);

  const target =
    method === "error"
      ? process.stderr
      : method === "warn"
        ? process.stderr
        : process.stdout;

  target.write(`${rendered}\n`);
};

/** One accent for the whole CLI. styleText drops the color for pipes and NO_COLOR. */
export const accent = (s: string) => styleText("cyanBright", s);

export const dim = (s: string) => styleText("dim", s);

export const log = (...values: unknown[]) =>
  stream("log", "cyanBright", ...values);

export const warn = (...values: unknown[]) =>
  stream("warn", "yellow", ...values);

export const printError = (...values: unknown[]) =>
  stream("error", "red", ...values);
