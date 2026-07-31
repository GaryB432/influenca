import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getVideoCorpus } from "$lib/server/corpus";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import type { RequestHandler } from "./$types";

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

export const GET: RequestHandler = async ({ params, request }) => {
  const manifest = await getVideoCorpus(params.stamp);
  // console.log(params)
  const { slug, stamp } = params;
  const videoEntry = manifest[slug] ?? {};
  const shortMP4JustName = Object.keys(videoEntry.video ?? {}).at(0);

  if (!shortMP4JustName) {
    error(502, `86 on the ${slug}`);
  }

  // const filePath = shortMP4JustName;
  const filePath = path.resolve(corpusRoot, stamp, shortMP4JustName);

  try {
    const stats = statSync(filePath);
    const totalSize = stats.size;

    // 1. Generate a fingerprint (ETag) using file size and modification time
    const etag = `W/"${totalSize}-${stats.mtimeMs}"`;

    // 2. Short-circuit if the browser already has this exact file cached
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 }); // 304 Not Modified
    }

    // Common caching headers for both full and partial responses
    const cacheHeaders = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
      "Content-Type": "video/mp4",
      ETag: etag,
    };

    const range = request.headers.get("range");

    // Scenario A: Full File Request
    if (!range) {
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream as ReadableStream, {
        headers: {
          ...cacheHeaders,
          "Content-Length": totalSize.toString(),
        },
      });
    }

    // Scenario B: Range Request (Partial Content)
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize || start > end) {
      return new Response(null, {
        headers: { "Content-Range": `bytes */${totalSize}` },
        status: 416,
      });
    }

    const chunkLength = end - start + 1;
    const nodeStream = createReadStream(filePath, { end, start });
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as ReadableStream, {
      headers: {
        ...cacheHeaders,
        "Content-Length": chunkLength.toString(),
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      },
      status: 206,
      statusText: "Partial Content",
    });
  } catch {
    error(404, filePath);
  }
};
