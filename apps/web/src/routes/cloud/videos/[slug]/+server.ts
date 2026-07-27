import { error } from "@sveltejs/kit";
import { getVideoCorpus } from "$lib/server/corpus";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
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
    // 1. Get the exact file size synchronously (or asynchronously if preferred)
    const stats = statSync(filePath);

    // 2. Create a standard Node read stream
    const nodeStream = createReadStream(filePath);

    // 3. Convert it to a native Web Stream that SvelteKit completely controls
    const webStream = Readable.toWeb(nodeStream);

    return new Response(webStream as ReadableStream, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": stats.size.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } catch {
    error(404, "Video not found");
  }
};
