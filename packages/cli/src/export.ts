import { readManifest, readTranscripts } from "@influenca/core/node";
import { access, copyFile, mkdir, rename, rm } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { copy } from "./copy.js";
import { invocation } from "./invocation.js";
import { startTable } from "./live.js";
import { latestRun, mediaDir } from "./paths.js";
import { accent, dim, log } from "./theme.js";

export type ExportOptions = {
  inDir?: string;
  /** Ids of the named files to copy. Left off, every named file goes. */
  only?: string[];
  /** The folder the named files are copied into. Made if it is not there. */
  to: string;
};

/**
 * Copies the files of a run that you have given a name, under that name, into a folder
 * of your choosing: PXL_20261010_175159748.mp4 arrives as pool-b-roll.mp4, with its
 * subtitles beside it. Naming a file is how you pick it. The run is left as it is.
 */
export async function runExport(opts: ExportOptions): Promise<void> {
  const dir = opts.inDir ? resolve(opts.inDir) : await latestRun(mediaDir());
  const to = resolve(opts.to);
  const manifest = await readManifest(dir);
  const transcripts = await readTranscripts(dir);
  const named = manifest.entries.filter(
    (e) => e.name && !e.deleted && (opts.only?.includes(e.id) ?? true),
  );

  log(accent(dir));
  if (named.length === 0) {
    log(
      dim(
        `Nothing has a name yet. Name the files you want on the web page (\`pnpm dev:web\`), then \`${invocation()} export\` again.`,
      ),
    );
    return;
  }

  await mkdir(to, { recursive: true });
  const table = startTable(
    named.map((e) => ({
      cells: [e.id, e.name ?? "", e.outputName],
      weight: e.bytes,
    })),
  );
  let copied = 0;
  try {
    for (const [i, e] of named.entries()) {
      const stem = fileName(e.name ?? "");
      const target = `${stem}${extname(e.outputName).toLowerCase()}`;
      const dest = join(to, target);
      if (await exists(dest)) {
        table.set(i, `${target} is already there`, "skipped");
        continue;
      }
      // Under another name until it is whole, so a copy that is cut short leaves no half file.
      const part = join(to, `.part-${target}`);
      await table.run(
        i,
        async (report) => {
          try {
            await copy(join(dir, e.outputName), part, e.bytes, report);
            await rename(part, dest);
          } catch (error) {
            await rm(part, { force: true });
            throw error;
          }
        },
        () => `copied as ${target}`,
      );
      copied++;
      const t = transcripts?.entries[e.id];
      if (t?.status === "done") {
        await copyFile(join(dir, t.vttName), join(to, `${stem}.vtt`));
      }
    }
  } finally {
    table.end();
  }
  log(`Copied ${copied} of ${named.length} named files to ${accent(to)}`);
}

/** Pure: a name as typed, made fit to be a filename on Windows as well as here. */
export function fileName(name: string): string {
  return name
    .trim()
    .replaceAll(/[<>:"/\\|?*\p{Cc}]+/gu, "-")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-{2,}/g, "-")
    .replaceAll(/^[-.]+|[-.]+$/g, "");
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
