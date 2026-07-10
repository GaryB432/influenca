import * as clack from "@clack/prompts";
import type { Database } from "../lib/database";
import { resolveMediaName, resolveSubjectFile } from "../lib/resolutions";
import { formatExifTable } from "../lib/tables";

export function greet(name: string): string {
  return `workflows says: hello to ${name}`;
}
export function add(a: number, b: number): number {
  return a + b;
}
export const meaning: { life: number } = {
  life: 42,
};

export async function namingWorkflow(db: Database): Promise<void> {
  let continueNaming = true;
  do {
    const subject = await resolveSubjectFile(db);
    if (clack.isCancel(subject)) {
      continueNaming = false;
    } else {
      if (subject.tags) {
        clack.log.success(formatExifTable(subject.tags));
      } else {
        clack.log.warn(`No Exif Tags (${subject.filename})`);
      }
      const betterName = await resolveMediaName(subject);
      if (clack.isCancel(betterName)) {
        continueNaming = false;
      } else {
        db.map[subject.filename].mediaFile.xtitle = betterName;
        const continuePrompt = await clack.confirm({
          message: "Name another file?",
        });

        if (clack.isCancel(continuePrompt) || !continuePrompt) {
          continueNaming = false;
        }
      }
    }
  } while (continueNaming);
}
