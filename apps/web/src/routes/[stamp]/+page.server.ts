import { type Manifest, fs as shims } from "@influenca/core";
import { error } from "@sveltejs/kit";
import { corpusRoot } from "$lib/server/corpus";
import path from "path";

import type { PageServerLoad } from "./$types";

const { existsSync, readJSONSync } = shims;

export const load = (async ({ params }) => {
  const { stamp } = params;
  const stampDirectory = path.resolve(corpusRoot, stamp);

  const manifestFilePath = path.join(stampDirectory, ".influenca.json");
  if (!existsSync(manifestFilePath)) {
    error(404, "Try a different stamp");
  }

  const manifest = readJSONSync<Manifest>(manifestFilePath);

  return { manifest, stamp, stampDirectory };
}) satisfies PageServerLoad;
