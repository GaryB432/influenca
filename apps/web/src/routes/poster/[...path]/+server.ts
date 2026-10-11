import { error } from "@sveltejs/kit";
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

import { mediaRoot, resolveInsideRoot } from "#lib/server/media.js";

import type { RequestHandler } from "./$types";

const run = promisify(execFile);

// Kept for as long as the server runs. A poster is a few tens of kilobytes.
const made = new Map<string, Promise<Buffer>>();

/**
 * One frame of a video as a JPEG. The browser could show a first frame itself, but only
 * for codecs it can decode, and phones record HEVC that many browsers cannot.
 */
export const GET: RequestHandler = async ({ params }) => {
  const path =
    params.path.toLowerCase().endsWith(".mp4") &&
    resolveInsideRoot(mediaRoot(), params.path);
  if (!path) error(404, "Not found");
  const file = await stat(path).catch(() => undefined);
  if (!file?.isFile()) error(404, "Not found");

  // A file that is replaced gets a new poster.
  const key = `${path}:${file.mtimeMs}:${file.size}`;
  let poster = made.get(key);
  if (!poster) {
    poster = frame(path);
    made.set(key, poster);
    poster.catch(() => made.delete(key));
  }
  try {
    return new Response(new Uint8Array(await poster), {
      headers: {
        "cache-control": "private, max-age=3600",
        "content-type": "image/jpeg",
      },
    });
  } catch {
    error(500, "Could not read a frame");
  }
};

/** A second in, past the fade or fumble a clip opens on; the very start if it is shorter than that. */
async function frame(path: string): Promise<Buffer> {
  for (const at of ["1", "0"]) {
    const { stdout } = await run(
      "ffmpeg",
      // -ss before -i seeks by keyframe, so this does not decode its way there.
      [
        "-v",
        "error",
        "-ss",
        at,
        "-i",
        path,
        "-frames:v",
        "1",
        "-vf",
        "scale=640:-2",
        "-f",
        "image2",
        "-c:v",
        "mjpeg",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
    );
    if (stdout.length > 0) return stdout;
  }
  throw new Error(`No frame in ${path}`);
}
