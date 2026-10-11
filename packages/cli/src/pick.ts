import { cancel, isCancel, multiselect } from "@clack/prompts";
import { readManifest } from "@influenca/core/node";

/**
 * Asks which of a run's named files to copy, all of them ticked to begin with. Resolves
 * with the ids chosen, or with undefined when there is nothing to choose between.
 */
export async function pickNamed(dir: string): Promise<string[] | undefined> {
  const { entries } = await readManifest(dir);
  const named = entries.filter((e) => e.name && !e.deleted);
  if (named.length < 2) return undefined;

  const picked = await multiselect({
    initialValues: named.map((e) => e.id),
    message: "Copy which? Space to tick, enter to go.",
    options: named.map((e) => ({
      hint: e.outputName,
      label: e.name ?? e.outputName,
      value: e.id,
    })),
    required: true,
  });
  if (isCancel(picked)) {
    cancel("Nothing copied.");
    process.exit(130);
  }
  return picked;
}
