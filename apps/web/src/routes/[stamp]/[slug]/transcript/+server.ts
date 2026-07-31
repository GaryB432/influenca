import { fs as gfs, type TranscriptionSegment } from "@influenca/core";
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { getVideoCorpus } from "$lib/server/corpus";
import path from "path";

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

export async function GET({ params }) {
  const { slug } = params;

  const manifest = await getVideoCorpus(params.stamp);

  try {
    const videoEntry = manifest[slug];

    if (!videoEntry.transcript) {
      throw new Error("video entry has no transcript");
    }

    const path_for_segments = path.join(
      corpusRoot,
      params.stamp,
      videoEntry.transcript.segments,
    );

    const segments_from_disk = gfs.readJSONSync<Array<TranscriptionSegment>>(
      path_for_segments,
      "utf-8",
    );
    const blank_segment = {
      avg_logprob: 0,
      compression_ratio: 0,
      end: 0,
      id: 0,
      no_speech_prob: 0,
      seek: 0,
      start: 0,
      temperature: 0,
      text: "shhh...",
      tokens: [],
    };
    const data = {
      videoEntry,
      vtt: videoEntry.transcript ? segments_from_disk : [blank_segment],
    };

    return json(data);
  } catch (error) {
    const details = error instanceof Error ? error.message : error;

    return json(
      { details, error: "Failed to read manifest file" },
      { status: 500 },
    );
  }
}
