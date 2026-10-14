import {
  type Curation,
  type Manifest,
  summarize,
  vttText,
} from "@influenca/core";
import { readManifest, updateEntry } from "@influenca/core/node";
import { error, fail } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  mediaRoot,
  resolveInsideRoot,
  windowsPath,
} from "#lib/server/media.js";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url: page }) => {
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

  let manifest: Manifest;
  try {
    manifest = await readManifest(dir);
  } catch (e) {
    // Not a run folder, or not one this influenca can read: either way there is no page for it.
    error(404, e instanceof Error ? e.message : "Not a run folder");
  }
  const url = (name: string, route = "media") =>
    `/${route}/${[...params.dir.split("/"), name].filter(Boolean).map(encodeURIComponent).join("/")}`;

  // ?tag=drone shows only the files tagged drone.
  const tag = page.searchParams.get("tag") || undefined;
  const shown = tag
    ? manifest.entries.filter((e) => e.tags?.includes(tag))
    : manifest.entries;

  return {
    files: await Promise.all(
      shown.map(async (entry) => {
        const path = join(dir, entry.outputName);
        const vttName =
          entry.transcript?.status === "done"
            ? entry.transcript.vttName
            : undefined;
        return {
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
          vttSrc: vttName && url(vttName),
        };
      }),
    ),
    run: params.dir || ".",
    summary: summarize(manifest),
    tag,
    /** Every tag used in the run, whatever is shown. */
    tags: [...new Set(manifest.entries.flatMap((e) => e.tags ?? []))].sort(),
  };
};

export const actions: Actions = {
  /** Saves what a form on the page sets about the entry it names: its title, which tags it has, or whether it is unwanted. */
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

    const title = form.get("title");
    const deleted = form.get("deleted");
    const tags = form.get("tags");
    const changes: Curation = {
      ...(typeof deleted === "string" && { deleted: deleted === "true" }),
      ...(typeof title === "string" && { title }),
      ...(typeof tags === "string" && { tags: tags.split(",") }),
    };
    try {
      await updateEntry(dir, id, changes);
    } catch (e) {
      return fail(404, { message: e instanceof Error ? e.message : String(e) });
    }
  },
};
