import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import type { OnProgress } from "../svc/ffmpeg.js";

/** Copies one file, reporting how far through it is. */
export async function copy(
  src: string,
  dest: string,
  bytes: number,
  onProgress: OnProgress,
): Promise<void> {
  let copied = 0;
  await pipeline(
    createReadStream(src),
    async function* (chunks: AsyncIterable<Buffer>) {
      for await (const chunk of chunks) {
        copied += chunk.length;
        if (bytes > 0) onProgress(copied / bytes);
        yield chunk;
      }
    },
    createWriteStream(dest),
  );
}
