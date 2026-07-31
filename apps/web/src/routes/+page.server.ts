import { env } from "$env/dynamic/private";
import { readdir } from "node:fs/promises";

import type { PageServerLoad } from "./$types";

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

export const load = (async () => {
  const entries = await readdir(corpusRoot, { withFileTypes: true });

  const stamps = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return { stamps };
}) satisfies PageServerLoad;
