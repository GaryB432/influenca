import { styleText } from "node:util";

/** One accent for the whole CLI. styleText drops the color for pipes and NO_COLOR. */
export const accent = (s: string) => styleText("cyanBright", s);

export const dim = (s: string) => styleText("dim", s);
