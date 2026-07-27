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

    // Read the Range header from the browser request
    const range = request.headers.get("range");

    // Scenario A: Standard request (No Range header) -> Send full file
    if (!range) {
      const nodeStream = createReadStream(filePath);
      const webStream = Readable.toWeb(nodeStream);

      return new Response(webStream as ReadableStream, {
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": totalSize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    }

    // Scenario B: Range request -> Parse bytes and send HTTP 206 Partial Content
    // Example range string format: "bytes=100023-400045" or "bytes=100023-"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    // Guard against malicious or malformed boundary requests
    if (start >= totalSize || end >= totalSize || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
    }

    const chunkLength = end - start + 1;

    // Create a precise chunk stream by utilizing options bounds
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as ReadableStream, {
      status: 206, // Partial Content
      statusText: "Partial Content",
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": chunkLength.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } catch {
    error(404, "Video not found");
  }
};
