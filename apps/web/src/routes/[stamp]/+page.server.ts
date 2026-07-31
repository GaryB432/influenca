import { type Manifest, fs as shims } from "@influenca/core";
import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import path from "path";

import type { PageServerLoad } from "./$types";

const { existsSync, readJSONSync } = shims;

const corpusRoot = env.INFLUENCA_MEDIA_DIR;

if (!corpusRoot) {
  throw new Error("INFLUENCA_MEDIA_DIR is required.");
}

export const load = (async ({ params }) => {
  const { stamp } = params;
  const stampDirectory = path.resolve(corpusRoot, params.stamp);

  const manifestFilePath = path.join(stampDirectory, ".influenca.json");
  if (!existsSync(manifestFilePath)) {
    error(404, "Try a different stamp");
  }

  const manifest = readJSONSync<Manifest>(manifestFilePath);

  return { manifest, stamp, stampDirectory };
}) satisfies PageServerLoad;
