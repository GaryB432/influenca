import { formatDuration, type Manifest, summarize } from "@influenca/core";
import { listRuns, readManifest } from "@influenca/core/node";
import { join } from "node:path";

import { mediaDir } from "./paths.js";

type Choice = { hint?: string; label: string; value: string };

/**
 * The runs in the media directory as the choices of a list, newest first: the same runs,
 * in the same order and words, as the list on the web app's front page. Each is answered
 * with its folder. Empty when there is no media directory to look in.
 */
export async function runChoices(): Promise<Choice[]> {
  let root: string;
  try {
    root = mediaDir();
  } catch {
    return [];
  }
  const choice = (manifest: Manifest, label: string, dir: string) => {
    const s = summarize(manifest);
    const files = s.counts.video + s.counts.audio + s.counts.image;
    const titled = manifest.entries.filter((e) => e.title && !e.deleted);
    return {
      // What export is after: whether there is anything here to take.
      hint: titled.length > 0 ? `${titled.length} titled` : undefined,
      label: `${label} · ${files} ${files === 1 ? "file" : "files"} · ${formatDuration(s.totalDurationSec)}`,
      value: dir,
    };
  };
  // A --no-timestamp run lives in the media directory itself.
  const here = await readManifest(root).catch(() => undefined);
  return [
    ...(here ? [choice(here, "(media directory)", root)] : []),
    ...(await listRuns(root).catch(() => [])).map((r) =>
      choice(r.manifest, r.name, join(root, r.name)),
    ),
  ];
}

/** The titled files of a run, as the choices of a tick list: the title to read, the file it is, its number to answer with. */
export async function titledChoices(dir: string): Promise<Choice[]> {
  const { entries } = await readManifest(dir);
  return entries
    .filter((e) => e.title && !e.deleted)
    .map((e) => ({
      hint: e.outputName,
      label: e.title ?? e.outputName,
      value: e.id,
    }));
}
