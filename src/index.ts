#!/usr/bin/env node

import * as clack from "@clack/prompts";
import cac from "cac";

import { Database } from "./lib/database";
import { setupEnvironment } from "./lib/environment";
import { resolveMediaName, resolveSubjectFile } from "./lib/resolutions";

setupEnvironment();

const cli = cac();

const cliOptions = cli.parse(process.argv, { run: false });

const [argDir] = cliOptions.args;

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

async function main() {
  clack.intro("📸 Influenca - EXIF Metadata Viewer");

  // let folderPath = mediaLocation;

  // the command line argument (might be empty)
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
      process.exit();
    }

    folderPath = result ?? argDir;
  }
  const db = new Database(folderPath);
  await db.read();

  if (Object.entries(db.map).length === 0) {
    const initialize = await clack.confirm({
      message: "Initialize Media Library",
    });
    if (clack.isCancel(initialize) || !initialize) {
      clack.cancel("Media database is uninitialized");
      process.exit();
    } else {
      await db.updateExif();
      await db.write();
    }
  }
  await namingWorkflow(db);
  await db.write();
  clack.outro("Done! 🎉");
}

async function namingWorkflow(db: Database): Promise<void> {
  let continueNaming = true;
  do {
    const subject = await resolveSubjectFile(db);
    if (clack.isCancel(subject)) {
      continueNaming = false;
    } else {
      clack.log.success(formatExifTable(subject.tags));
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

void main();
