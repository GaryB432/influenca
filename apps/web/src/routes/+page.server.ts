import { type Run, summarize } from "@influenca/core";
import { listRuns, readManifest } from "@influenca/core/node";
import { error } from "@sveltejs/kit";

import { mediaRoot } from "#lib/server/media.js";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  let root: string;
  try {
    root = mediaRoot();
  } catch (e) {
    error(
      500,
      e instanceof Error ? e.message : "Media directory is not configured",
    );
  }

  let runs: Run[];
  try {
    runs = await listRuns(root);
  } catch {
    error(500, `Cannot read the media directory ${root}`);
  }
  // A --no-timestamp run lives in the media directory itself and is served at /view.
  const here = await readManifest(root).catch(() => undefined);

  return {
    root,
    runs: [
      ...(here
        ? [{ href: "/view", manifest: here, name: "(media directory)" }]
        : []),
      ...runs.map((r) => ({
        ...r,
        href: `/view/${encodeURIComponent(r.name)}`,
      })),
    ].map(({ href, manifest, name }) => ({
      href,
      name,
      summary: summarize(manifest),
    })),
  };
};
