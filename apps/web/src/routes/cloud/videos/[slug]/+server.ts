import { error } from "@sveltejs/kit";
import { getVideoCorpus } from "$lib/server/corpus";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request }) => {
  const manifest = await getVideoCorpus();
  const { slug } = params;
  const videoEntry = manifest[slug];
  const videoEntryKeys = Object.keys(videoEntry.video ?? {});
  const mp4name = videoEntryKeys.at(0);

  if (!mp4name) {
    error(502, `86 on the ${slug}`);
  }

  const filePath = mp4name;

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
      "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
      ETag: etag,
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
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
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }

    const chunkLength = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as ReadableStream, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        ...cacheHeaders,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunkLength.toString(),
      },
    });
  } catch {
    error(404, "Video not found");
  }
};
