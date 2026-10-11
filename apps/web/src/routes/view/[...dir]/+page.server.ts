import {
  isManifest,
  MANIFEST_FILENAME,
  summarize,
  vttText,
} from "@influenca/core";
import { readAnalysis, readJSON, readTranscripts } from "@influenca/core/node";
import { error } from "@sveltejs/kit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  mediaRoot,
  resolveInsideRoot,
  windowsPath,
} from "#lib/server/media.js";

import type { PageServerLoad } from "./$types";

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
