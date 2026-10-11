import {
  type Curation,
  isManifest,
  MANIFEST_FILENAME,
  summarize,
  vttText,
} from "@influenca/core";
import {
  readAnalysis,
  readJSON,
  readTranscripts,
  updateEntry,
} from "@influenca/core/node";
import { error, fail } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  mediaRoot,
  resolveInsideRoot,
  windowsPath,
} from "#lib/server/media.js";

import type { Actions, PageServerLoad } from "./$types";

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

  const [analysis, transcripts] = await Promise.all([
    readAnalysis(dir),
    readTranscripts(dir),
  ]);
  const url = (name: string, route = "media") =>
    `/${route}/${[...params.dir.split("/"), name].filter(Boolean).map(encodeURIComponent).join("/")}`;

  return {
    files: await Promise.all(
      manifest.entries.map(async (entry) => {
        const transcript = transcripts?.entries[entry.id];
        const path = join(dir, entry.outputName);
        const vttName =
          transcript?.status === "done" ? transcript.vttName : undefined;
        return {
          analysis: analysis?.entries[entry.id],
          entry,
          // Where to pick the file up from, when it is wanted in a project.
          paths: [path, windowsPath(path)].filter((p) => p !== undefined),
          poster:
            entry.kind === "video"
              ? url(entry.outputName, "poster")
              : undefined,
          // A .vtt that has gone missing is no reason to lose the page.
          said: vttName
            ? await readFile(join(dir, vttName), "utf8").then(
                vttText,
                () => undefined,
              )
            : undefined,
          src: url(entry.outputName),
          transcript,
          vttSrc: vttName && url(vttName),
        };
      }),
    ),
    run: params.dir || ".",
    summary: summarize(manifest),
  };
};

export const actions: Actions = {
  /** Saves what a form on the page sets about the entry it names: its name, or whether it is unwanted. */
  update: async ({ params, request, url }) => {
    // SvelteKit turns away form posts from other sites, but not under `vite dev`, which is
    // how this app is run. A browser names the page a post came from; a script has no need to.
    const from = request.headers.get("origin");
    if (from && from !== url.origin)
      error(403, "Cross-site posts are not accepted");
    const dir = resolveInsideRoot(mediaRoot(), params.dir);
    if (!dir) error(400, "Invalid path");

    const form = await request.formData();
    const id = form.get("id");
    if (typeof id !== "string" || id === "")
      return fail(400, { message: "No entry named" });
    const name = form.get("name");
    const deleted = form.get("deleted");
    const changes: Curation = {
      ...(typeof deleted === "string" && { deleted: deleted === "true" }),
      ...(typeof name === "string" && { name }),
    };
    try {
      await updateEntry(dir, id, changes);
    } catch (e) {
      return fail(404, { message: e instanceof Error ? e.message : String(e) });
    }
  },
};
