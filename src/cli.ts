#!/usr/bin/env node

import { cancel, intro, outro } from "@clack/prompts";
import cac from "cac";
import { Database, listMedia } from "./lib/database";
import { resolveFolderPath } from "./lib/resolutions";
import type { CacParsedArgv } from "./lib/types";
import { namingWorkflow } from "./lib/workflows";

const cli = cac();
cli.option("--list, -l", "List Media");
const cliOptions: CacParsedArgv = cli.parse(process.argv, { run: false });
const [argDir] = cliOptions.args;

intro("📸 Influenca - EXIF Metadata Viewer");
resolveFolderPath(argDir).then(async (loc) => {
  if (!loc) {
    cancel("no db path was given");
    process.exit(1);
  }
  const db = new Database(loc);
  await db.read();
  if (cliOptions.options.list) {
    listMedia(db);
  } else {
    await namingWorkflow(db);
    db.write();
  }
  outro("Done! 🎉");
});
