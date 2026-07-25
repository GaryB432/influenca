import { fs, type TranscriptionSegment } from "@influenca/core";
import { json } from "@sveltejs/kit";
import { getVideoCorpus } from "$lib/server/corpus";

export async function GET({ params }) {
  const { slug } = params;

  const manifest = await getVideoCorpus();

  try {
    const videoEntry = manifest[slug];

    const data = {
      videoEntry,
      vtt: videoEntry.transcript
        ? fs.readJSONSync<Array<TranscriptionSegment>>(
            videoEntry.transcript.segments,
            "utf-8",
          )
        : [
            {
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
            },
          ],
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
