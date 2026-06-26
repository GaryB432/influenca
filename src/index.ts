#!/usr/bin/env node

import * as clack from "@clack/prompts";
import cac from "cac";

import type { CacParsedArgv } from "./lib/types";

import { Database } from "./lib/database";
import { setupEnvironment } from "./lib/environment";
import { resolveMediaName, resolveSubjectFile } from "./lib/resolutions";
import { formatExifTable } from "./lib/tables";

setupEnvironment();

const clic = cac();

clic.option("--list, -l", "List Media");

const cliOptions: CacParsedArgv = clic.parse(process.argv, { run: false });

const [argDir] = cliOptions.args;

function listMedia(db: Database): void {
  console.log(
    Object.values(db.map)
      .map((m) => {
        const mediaTitle = m.mediaFile.xtitle || m.mediaFile.filename;
        m.keywords.push("test");
        return { mediaTitle, keywordString: m.keywords.join() };
      })
      .toSorted((a, b) => a.mediaTitle.localeCompare(b.mediaTitle))
      .map((m) => m.mediaTitle.concat(" > ").concat(m.keywordString))
      .join("\n"),
  );
}

async function main() {
  clack.intro("📸 Influenca - EXIF Metadata Viewer");

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

  if (cliOptions.options.list) {
    listMedia(db);
  } else {
    await namingWorkflow(db);
    await db.write();
  }

  clack.outro("Done! 🎉");
}

async function namingWorkflow(db: Database): Promise<void> {
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

void main();
