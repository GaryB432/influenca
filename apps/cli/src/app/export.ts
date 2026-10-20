import { FcpTimeline, FCPXML_FILE_NAME } from "@influenca/core";
import { exists, readManifest } from "@influenca/core/node";
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { extname, join, parse, resolve } from "node:path";

import { copy } from "./copy.js";
import { invocation } from "./invocation.js";
import { startTable } from "./live.js";
import { latestRun, mediaDir } from "./paths.js";
import { accent, dim, log, printError, warn } from "./theme.js";

export type ExportOptions = {
  /** Create fcpxml file. Off by default. */
  fcpxml: boolean;
  inDir?: string;
  /** Ids of the titled files to copy. Left off, every titled file goes. */
  only?: string[];
  /** Copy the .vtt subtitle file alongside each video. Off by default. */
  subtitles?: boolean;
  /** Copy only the titled files with this tag. */
  tag?: string;
  /** The folder the titled files are copied into. Made if it is not there. */
  to: string;
};

/**
 * Copies the files of a run that you have given a title into a folder of your choosing,
 * each under a filename made from its title: "Pool b-roll" arrives as pool-b-roll.mp4,
 * with its subtitles beside it. Giving a file a title is how you pick it, and a tag
 * narrows the pick. The run is left as it is.
 */
export async function runExport(opts: ExportOptions): Promise<void> {
  if (opts.fcpxml) {
    warn("EXPERIMENTAL");
  }
  const experimental_timeline = new FcpTimeline();
  const dir = opts.inDir ? resolve(opts.inDir) : await latestRun(mediaDir());
  const to = resolve(opts.to);
  const manifest = await readManifest(dir);
  const titled = manifest.entries.filter(
    (e) =>
      e.title &&
      !e.deleted &&
      (opts.only?.includes(e.id) ?? true) &&
      (opts.tag === undefined || e.tags?.includes(opts.tag)),
  );

  log(accent(dir));
  if (titled.length === 0 && opts.tag !== undefined) {
    log(dim(`Nothing titled is tagged ${opts.tag}.`));
    return;
  }
  if (titled.length === 0) {
    log(
      dim(
        `Nothing has a title yet. Give the files you want one on the web page (\`pnpm dev:web\`), then \`${invocation()} export\` again.`,
      ),
    );
    return;
  }

  const fcp_dest = join(to, FCPXML_FILE_NAME);
  if (await exists(fcp_dest)) {
    printError(`"${fcp_dest}" already exists.`);
    return;
  }

  await mkdir(to, { recursive: true });
  const table = startTable(
    titled.map((e) => ({
      cells: [e.id, e.title ?? "", e.outputName],
      weight: e.bytes,
    })),
  );
  let copied = 0;
  try {
    for (const [i, e] of titled.entries()) {
      // A title with no letter or number in it, all emoji say, leaves nothing to name a file by.
      const stem = slug(e.title ?? "") || parse(e.outputName).name;
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
      if (opts.fcpxml) {
        await experimental_timeline.add(e, stem, target, dest);
      }
      const t = e.transcript;
      if (opts.subtitles && t?.status === "done") {
        await copyFile(join(dir, t.vttName), join(to, `${stem}.vtt`));
      }
    }
  } finally {
    table.end();
    experimental_timeline.end();
  }
  const which = opts.tag === undefined ? "titled" : `titled ${opts.tag}`;
  log(`Copied ${copied} of ${titled.length} ${which} files to ${accent(to)}`);

  if (opts.fcpxml) {
    await writeFile(fcp_dest, experimental_timeline.xml(), "utf8");
    log(`Created  ${accent(fcp_dest)}`);
  }
}

/**
 * Pure: a title as typed, turned into the stem of a filename. Letters and numbers are
 * kept, in lowercase, and each run of anything else becomes one hyphen: "Agnes, if you
 * get it" is agnes-if-you-get-it.
 */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/g, "");
}
