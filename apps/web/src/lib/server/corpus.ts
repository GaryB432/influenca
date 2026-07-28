import type { Manifest, VideoStatisticalBlock } from "@influenca/core";

import { env } from "$env/dynamic/private";
import fs from "node:fs/promises";
import path from "node:path";

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

const CORPUS_DIR = path.join(corpusRoot, "20260727T203224Z");

let cachedCorpus: Manifest;

export async function getVideoCorpus() {
  if (!cachedCorpus) {
    try {
      const filePath = path.resolve(CORPUS_DIR, ".influenca.json");
      const rawData = await fs.readFile(filePath, "utf-8");
      cachedCorpus = JSON.parse(rawData);

      Object.values(cachedCorpus).forEach((vid) => {
        if (vid.transcript) {
          vid.transcript.segments = path.resolve(
            CORPUS_DIR,
            vid.transcript.segments,
          );
        }
        if (vid.video) {
          const root_vid: Record<string, { stats: VideoStatisticalBlock }> = {};

          for (const vkey in vid.video) {
            root_vid[path.resolve(CORPUS_DIR, vkey)] = vid.video[vkey];
          }
          vid.video = root_vid;
        }
      });
    } catch (error) {
      console.error("Failed to load JSON:", error);
    }
  }
  return cachedCorpus;
}
