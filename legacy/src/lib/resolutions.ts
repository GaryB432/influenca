import * as clack from "@clack/prompts";

import type { Database } from "../lib/database";
import type { MediaFile } from "../lib/types";

export function add(a: number, b: number): number {
  return a + b;
}

export function greet(name: string): string {
  return `resolutions says: hello to ${name}`;
}

async function getOptions(db: Database): Promise<clack.Option<MediaFile>[]> {
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
  if (file.tags?.ImageDescription) {
    clack.log.info(file.tags?.ImageDescription?.description);
  }
  const existingTitle = file.xtitle || file.tags?.ImageDescription?.description;
  const enterTitleMessage = `Enter a title for "${file.filename}":`;
  const new_title = await clack.text({
    defaultValue: existingTitle || "",

    message: existingTitle
      ? enterTitleMessage.concat(` (Leave blank for "${existingTitle}")`)
      : enterTitleMessage,
    placeholder: "e.g., Sunset at the beach",
    validate: (value) => {
      if (!value && !existingTitle) {
        return "Please enter a title";
      }
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

export async function resolveFolderPath(
  argDir: string | undefined,
): Promise<string | undefined> {
  // const options = await getOptions(db);

  let folderPath = argDir || process.env.MEDIA;

  if (!folderPath) {
    const result = await clack.text({
      message: "Enter the path to your media folder:",
      placeholder: "./photos",
      validate: (value) => {
        if (!value) return "Please enter a folder path";
      },
    });

    if (clack.isCancel(result)) {
      clack.cancel("Operation cancelled");
      return undefined;
    }

    folderPath = result ?? argDir;
  }
  return folderPath;
  // const db = new Database(folderPath);
  // await db.read();

  // if (Object.entries(db.map).length === 0) {
  //   const initialize = await clack.confirm({
  //     message: "Initialize Media Library",
  //   });
  //   if (clack.isCancel(initialize) || !initialize) {
  //     clack.cancel("Media database is uninitialized");
  //     process.exit();
  //   } else {
  //     await db.updateExif();
  //     await db.write();
  //   }
  // }
}
