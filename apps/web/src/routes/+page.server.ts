import { corpusRoot } from "$lib/server/corpus";
import { readdir } from "node:fs/promises";

import type { PageServerLoad } from "./$types";

export const load = (async () => {
  const entries = await readdir(corpusRoot, { withFileTypes: true });

  const stamps = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return { stamps };
}) satisfies PageServerLoad;
