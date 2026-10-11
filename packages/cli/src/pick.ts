import { readManifest } from "@influenca/core/node";

/** The titled files of a run, as the choices of a tick list: the title to read, the file it is, its number to answer with. */
export async function titledChoices(
  dir: string,
): Promise<{ hint: string; label: string; value: string }[]> {
  const { entries } = await readManifest(dir);
  return entries
    .filter((e) => e.title && !e.deleted)
    .map((e) => ({
      hint: e.outputName,
      label: e.title ?? e.outputName,
      value: e.id,
    }));
}
