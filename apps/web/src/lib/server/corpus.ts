import type { Manifest } from "@influenca/core";

import { fs as gfs } from "@influenca/core";
import { env } from "$env/dynamic/private";
import path from "node:path";

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

export async function getVideoCorpus(stamp: string): Promise<Manifest> {
  return gfs.readJSONSync<Manifest>(
    path.resolve(path.resolve(corpusRoot, stamp), ".influenca.json"),
  );
}
