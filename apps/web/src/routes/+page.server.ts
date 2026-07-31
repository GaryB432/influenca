import { corpusRoot } from "$lib/server/corpus";
import { statSync } from "node:fs";
import { readdir } from "node:fs/promises";

import type { PageServerLoad } from "./$types";
import path from "node:path";

export const load = (async () => {
  const entries = await readdir(corpusRoot, { withFileTypes: true });

  const stamps = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => {
      return (
        statSync(path.join(b.parentPath, b.name)).mtimeMs -
        statSync(path.join(a.parentPath, a.name)).mtimeMs
      );
    })
    .map((entry) => entry.name);

  return { stamps };
}) satisfies PageServerLoad;
