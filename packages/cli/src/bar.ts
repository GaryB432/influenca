import { outro, spinner, unicodeOr } from "@clack/prompts";

import type { OnProgress } from "./ffmpeg.js";

import { accent, dim } from "./theme.js";

const BAR = unicodeOr("━", "=");
const BAR_SIZE = 30;

/** One bar across several jobs, each weighted by its share of the total. */
export function startBar(total: number) {
  // clack draws regardless of where stdout goes, so keep the bar out of pipes and logs.
  const bar = process.stdout.isTTY
    ? spinner({ styleFrame: accent })
    : undefined;
  let finished = 0;
  bar?.start(meter(0));

  return {
    fail: (message: string) => bar?.error(message),
    /** Closes the bar with a result line and, optionally, a parting hint. */
    finish(message: string, hint?: string) {
      if (bar) {
        bar.stop(message);
        if (hint) outro(hint);
      } else {
        console.log(message);
        if (hint) console.log(hint);
      }
    },
    /** Runs one job, handing it a reporter for its own 0..1. */
    async job<T>(
      weight: number,
      label: string,
      work: (report: OnProgress) => Promise<T>,
    ): Promise<T> {
      const report: OnProgress = (fraction) => {
        const at = finished + Math.min(1, Math.max(0, fraction)) * weight;
        bar?.message(`${meter(total === 0 ? 1 : at / total)} ${dim(label)}`);
      };
      const result = await work(report);
      report(1);
      finished += weight;
      return result;
    },
  };
}

/** Drawn here rather than with clack's progress(), whose bar color is fixed. */
function meter(fraction: number): string {
  const filled = Math.floor(fraction * BAR_SIZE);
  const bar = accent(BAR.repeat(filled)) + dim(BAR.repeat(BAR_SIZE - filled));
  return `${bar} ${Math.floor(fraction * 100)}%`;
}
