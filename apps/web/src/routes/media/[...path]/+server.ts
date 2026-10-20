import { error } from "@sveltejs/kit";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";

import { mediaRoot, resolveInsideRoot } from "#lib/server/media.js";

import type { RequestHandler } from "./$types";

// Only what a run folder keeps for viewing; the .influenca files are not served.
const TYPES: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".vtt": "text/vtt; charset=utf-8",
};

type Range = { end: number; start: number };

/** Serves one kept file. Players ask for byte ranges, which is what lets them seek. */
export const GET: RequestHandler = async ({ params, request }) => {
  const type = TYPES[extname(params.path).toLowerCase()];
  const path = type && resolveInsideRoot(mediaRoot(), params.path);
  if (!path) error(404, "Not found");
  const size = await stat(path).then(
    (s) => (s.isFile() ? s.size : undefined),
    () => undefined,
  );
  if (size === undefined) error(404, "Not found");

  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      headers: { "content-range": `bytes */${size}` },
      status: 416,
    });
  }
  const { end, start } = range ?? { end: size - 1, start: 0 };
  return new Response(
    size === 0
      ? null
      : (Readable.toWeb(
          createReadStream(path, { end, start }),
        ) as ReadableStream),
    {
      headers: {
        "accept-ranges": "bytes",
        "content-length": String(end - start + 1),
        "content-type": type,
        ...(range && { "content-range": `bytes ${start}-${end}/${size}` }),
      },
      status: range ? 206 : 200,
    },
  );
};

/** One range only: "bytes=0-99", "bytes=100-" or "bytes=-100". Anything else gets the whole file. */
function parseRange(
  header: null | string,
  size: number,
): "unsatisfiable" | Range | undefined {
  const [, from, to] = /^bytes=(\d*)-(\d*)$/.exec(header ?? "") ?? [];
  if (!from && !to) return undefined;
  const range = from
    ? {
        end: to ? Math.min(Number(to), size - 1) : size - 1,
        start: Number(from),
      }
    : { end: size - 1, start: Math.max(0, size - Number(to)) };
  return range.start > range.end ? "unsatisfiable" : range;
}
