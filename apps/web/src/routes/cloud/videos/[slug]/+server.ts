import { error } from "@sveltejs/kit";
import { getVideoCorpus } from "$lib/server/corpus";
import { open } from "node:fs/promises";

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
    const fileHandle = await open(filePath, "r");
    const stat = await fileHandle.stat();

    // 1. Get the Node web-compatible stream
    const webStream = fileHandle.readableWebStream();

    // 2. Pass it directly to Response, casting it to 'any'
    // This overrides the typing mismatch between Node and the browser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(webStream as any, {
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": stat.size.toString(),
        "Content-Type": "video/mp4",
      },
    });
  } catch {
    error(404, "Video not found");
  }
};
