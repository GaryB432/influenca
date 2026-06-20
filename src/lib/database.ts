import * as clack from "@clack/prompts";
import ExifReader from "exifreader";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as nap } from "node:timers/promises";

import type { MediaFile, MediaMap } from "./types";

export class Database {
  readonly loc: string;
  map: MediaMap = {};
  private readonly DB_JSON = ".influenca-names.json";

  constructor(loc: string) {
    this.loc = loc;
  }
  public async read(): Promise<void> {
    const dbp = join(this.loc, this.DB_JSON);
    try {
      if (existsSync(dbp)) {
        const data = await readFile(dbp, "utf-8");
        // console.log(data.length);
        // return {};
        this.map = JSON.parse(data);
      } else {
        clack.log.warn(`no config at '${dbp}'`);
      }
    } catch {}
  }

  public async updateExif() {
    const files = await readdir(this.loc);
    const mediaFiles: MediaFile[] = [];

    const spinner = clack.spinner();

    spinner.start("Loading media files...");

    // // const mediaFiles = await fsReadThisFolderIntoTheADb(folderPath, namingDb);
    // const unnamed = mediaFiles.filter((f) => !f.title);

    // const named = 42;
    // // const named = mediaFiles.filter((f) => f.title);

    for (const file of files.slice(0, 200)) {
      const ext = file.toLowerCase();
      //   spinner.message("going for exif");
      if (ext.match(/\.(jpg|mp4|jpeg|png|tiff|heic|webp|raw|cr2|nef|arw)$/)) {
        const filePath = join(this.loc, file);
        let tags: Partial<ExifReader.Tags> = {};
        try {
          await nap(200);
          //   this.map[filePath] = {
          //     mediaFile: { path: this.loc, filename: filePath, tags },
          //     clips: [],
          //     keywords: [],
          //   };
          tags = await ExifReader.load(filePath);
        } catch {}

        mediaFiles.push({
          filename: file,
          path: this.loc,
          tags,
        });
      } else {
        clack.log.warn(`skipping ${ext}`);
      }
    }
    console.log(mediaFiles);
    mediaFiles.forEach((mediaFile) => {
      this.map[mediaFile.filename] = { clips: [], keywords: [], mediaFile };
    });
    spinner.stop();
  }

  public async write() {
    const dbp = join(this.loc, this.DB_JSON);

    await writeFile(dbp, JSON.stringify(this.map, null, 2), "utf-8");
    clack.log.success(`saved ${dbp}`);
  }
}
