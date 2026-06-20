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
    if (!existsSync(loc)) {
      throw new Error(` cannot access '${loc}': No such file or directory`);
    }
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
    const mediaFiles: MediaFile[] = [];

    const files = (
      await readdir(this.loc, {
        recursive: false,
        withFileTypes: true,
        encoding: "utf-8",
      })
    ).filter((n) => n.isFile());

    const prog = clack.progress({ style: "block", max: files.length });

    prog.start();

    for (const file of files) {
      prog.advance(1, `Extracting Exif for ${file.name}`);
      const ext = file.name.toLowerCase();

      if (ext.match(/\.(jpg|mp4|jpeg|png|tiff|heic|webp|raw|cr2|nef|arw)$/)) {
        let tags: Partial<ExifReader.Tags> = {};
        try {
          await nap(200);

          tags = await ExifReader.load(join(this.loc, file.name));
        } catch (e) {
          // const nodeError = e as NodeJS.ErrnoException;
          // clack.log.warn(nodeError.message);
        }

        mediaFiles.push({
          filename: file.name,
          path: this.loc,
          tags,
        });
      } else {
        clack.log.warn(`skipping ${file.name}`);
      }
    }
    mediaFiles.forEach((mediaFile) => {
      this.map[mediaFile.filename] = { clips: [], keywords: [], mediaFile };
    });
    prog.stop();
  }

  public async write() {
    const dbp = join(this.loc, this.DB_JSON);

    await writeFile(dbp, JSON.stringify(this.map, null, 2), "utf-8");
    clack.log.success(`saved ${dbp}`);
  }
}
