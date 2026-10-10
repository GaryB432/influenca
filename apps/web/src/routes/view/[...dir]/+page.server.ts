import { isManifest, MANIFEST_FILENAME, summarize } from "@influenca/core";
import { readJSON } from "@influenca/core/node";
import { error } from "@sveltejs/kit";
import { join } from "node:path";

import type { PageServerLoad } from "./$types";

import { mediaRoot, resolveInsideRoot } from "../../../lib/server/media.js";

export const load: PageServerLoad = async ({ params }) => {
  let root: string;
  try {
    root = mediaRoot();
  } catch (e) {
    error(
      500,
      e instanceof Error ? e.message : "Media directory is not configured",
    );
  }

  const dir = resolveInsideRoot(root, params.dir);
  if (!dir) error(400, "Invalid path");

  const where = params.dir || "the media directory";
  let manifest: unknown;
  try {
    manifest = await readJSON(join(dir, MANIFEST_FILENAME));
  } catch {
    error(404, `No ${MANIFEST_FILENAME} in ${where}`);
  }
  if (!isManifest(manifest)) {
    error(422, `${MANIFEST_FILENAME} in ${where} is not a version 1 manifest`);
  }
  return { manifest, run: params.dir || ".", summary: summarize(manifest) };
};
