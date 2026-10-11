import { readManifest } from "@influenca/core/node";

/** The named files of a run, as the choices of a tick list: the name to read, the file it is, its number to answer with. */
export async function namedChoices(
  dir: string,
): Promise<{ hint: string; label: string; value: string }[]> {
  const { entries } = await readManifest(dir);
  return entries
    .filter((e) => e.name && !e.deleted)
    .map((e) => ({
      hint: e.outputName,
      label: e.name ?? e.outputName,
      value: e.id,
    }));
}
