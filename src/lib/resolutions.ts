import * as clack from "@clack/prompts";

import type { Database } from "./database";
import type { MediaFile } from "./types";

export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return `resolutions says: hello to ${name}`;
}

async function getOptions(db: Database): Promise<any> {
  const options = Object.values(db.map)
    .map((d) => d.mediaFile)
    .map((mf) => ({
      hint: mf.xtitle || mf.xcamera,
      label: mf.xtitle ? `✓ ${mf.filename}` : mf.filename,
      value: mf,
    }));
  return options;
}

export const meaning: { life: number } = {
  life: 42,
};

export async function resolveMediaName(
  file: MediaFile,
): Promise<string | symbol> {
  const new_title = await clack.text({
    defaultValue: file.xtitle,
    message: `Enter a title for "${file.filename}":`,
    placeholder: "e.g., Sunset at the beach",
    validate: (value) => {
      if (!value || value.trim().length === 0) return "Please enter a title";
    },
  });
  return new_title;
}

export async function resolveSubjectFile(
  db: Database,
): Promise<MediaFile | symbol> {
  const options = await getOptions(db);
  return clack.select<MediaFile>({
    maxItems: 10,
    message: "Select a file to name:",
    options,
  });
}
