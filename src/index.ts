#!/usr/bin/env node

import * as clack from "@clack/prompts";
import { Database } from "./lib/database";
import { setupEnvironment } from "./lib/environment";

setupEnvironment();

const mediaLocation = process.env.MEDIA || "~/.local/state/influenca";

function formatExifTable(tags: any): string {
  const rows: string[] = [];

  const fields = [
    { key: "Make", label: "Camera Make" },
    { key: "Model", label: "Camera Model" },
    { key: "DateTimeOriginal", label: "Date Taken" },
    { key: "ExposureTime", label: "Shutter Speed" },
    { key: "FNumber", label: "Aperture" },
    { key: "ISOSpeedRatings", label: "ISO" },
    { key: "FocalLength", label: "Focal Length" },
    { key: "LensModel", label: "Lens" },
    { key: "ImageWidth", label: "Width" },
    { key: "ImageHeight", label: "Height" },
  ];

  for (const { key, label } of fields) {
    const value = tags[key]?.description || tags[key]?.value || "-";
    rows.push(`${label.padEnd(20)} ${value}`);
  }

  return rows.join("\n");
}

async function namingWorkflow(db: Database): Promise<void> {
  let continueNaming = true;

  while (continueNaming) {
    const options = Object.values(db.map)
      .map((d) => d.mediaFile)
      .map((mf) => ({
        value: mf.filename,
        label: mf.xtitle ? `✓ ${mf.filename}` : mf.filename,
        hint: mf.xtitle || mf.xcamera,
      }));

    if (options.length === 0) {
      clack.log.warn(`no media ${JSON.stringify(db.loc)}`);

      break;
    } else {
      const selectedFile = await clack.select({
        message: "Select a file to name:",
        options,
      });
      if (clack.isCancel(selectedFile)) {
        clack.cancel("Operation cancelled");
        return;
      }
      const file = db.map[selectedFile].mediaFile;
      if (!file) {
        clack.cancel(selectedFile);
        return;
      }

      clack.log.success(formatExifTable(file.tags));

      const raw_title = await clack.text({
        message: `Enter a title for "${file.filename}":`,
        placeholder: "e.g., Sunset at the beach",
        defaultValue: file.xtitle,
        validate: (value) => {
          if (!value || value.trim().length === 0)
            return "Please enter a title";
        },
      });

      if (clack.isCancel(raw_title)) {
        clack.cancel("Operation cancelled");
        return;
      }

      db.map[file.filename].mediaFile = {
        ...file,
        xtitle: raw_title.trim(),
      };
      await db.write();
      clack.log.success(`Saved title for "${file.filename}"`);
    }

    const continuePrompt = await clack.confirm({
      message: "Name another file?",
    });

    if (clack.isCancel(continuePrompt) || !continuePrompt) {
      continueNaming = false;
    }
  }
}

async function main() {
  clack.intro("📸 Influenca - EXIF Metadata Viewer");

  let folderPath = mediaLocation;

  if (!folderPath) {
    const result = await clack.text({
      message: "Enter the path to your media folder:",
      placeholder: "./photos",
      defaultValue: process.env["PWPP"],
      validate: (value) => {
        if (!value) return "Please enter a folder path";
      },
    });

    if (clack.isCancel(result)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    folderPath = result;
  }
  const db = new Database(folderPath);
  await db.read();

  if (Object.entries(db.map).length === 0) {
    const initialize = await clack.confirm({
      message: "Initialize Media Library",
    });
    if (clack.isCancel(initialize)) {
      clack.cancel("empty");
    }
    await db.updateExif();
  }

  await namingWorkflow(db);
  clack.outro("Done! 🎉");
}

// console.log(mediaLocation, process.argv);
// const href = new URL(process.argv[1], "file://").href;
// const url = import.meta.url;
// if (url === href) {
//   if (!mediaLocation) throw new Error("cannot go on like this");
//   main();
// } else {
//   console.log({ href, url });
// }

main().then(
  () => {
    console.log("finished");
  },
  () => {
    console.error("nope");
  },
);
