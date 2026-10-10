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
  stream: NodeJS.WriteStream,
  style: Parameters<typeof styleText>[0],
  ...values: unknown[]
) => {
  const message = values.map(format).join(" ");
  stream.write(`${styleText(style, message)}\n`);
};

/** One accent for the whole CLI. styleText drops the color for pipes and NO_COLOR. */
export const accent = (s: string) => styleText("cyanBright", s);

export const dim = (s: string) => styleText("dim", s);

export const log = (...values: unknown[]) =>
  stream(process.stdout, "cyanBright", ...values);

export const warn = (...values: unknown[]) =>
  stream(process.stderr, "yellow", ...values);

export const printError = (...values: unknown[]) =>
  stream(process.stderr, "red", ...values);
