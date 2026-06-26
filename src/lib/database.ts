import * as clack from "@clack/prompts";
import ExifReader from "exifreader";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { MediaFile, MediaMap } from "./types";

export class Database {
  readonly loc: string;
  map: MediaMap = {};
  private readonly DB_JSON = ".influenca.json";

  constructor(loc: string) {
    if (!existsSync(loc)) {
      throw new Error(` cannot access '${loc}': No such file or directory`);
    }
    this.loc = loc;
  }
  public async read(): Promise<void> {
    const dbp = join(this.loc, this.DB_JSON);
    if (existsSync(dbp)) {
      const data = await readFile(dbp, "utf-8");
      this.map = JSON.parse(data);
    } else {
      clack.log.warn(`No Media Library at '${dbp}'`);
    }
  }

  public async updateExif() {
    const mediaFiles: MediaFile[] = [];

    const files = (
      await readdir(this.loc, {
        encoding: "utf-8",
        recursive: false,
        withFileTypes: true,
      })
    ).filter((n) => n.isFile());

    const prog = clack.progress({ max: files.length, style: "heavy" });
    prog.start();

    let skippedCount = 0;
    let errorCount = 0;
    for (const file of files) {
      prog.advance(1, `Extracting Exif for ${file.name}`);
      const ext = file.name.toLowerCase();

      if (ext.match(/\.(jpg|mp4|jpeg|png|tiff|heic|webp|raw|cr2|nef|arw)$/)) {
        let tags: Partial<ExifReader.Tags> = {};
        try {
          tags = await ExifReader.load(join(this.loc, file.name));
        } catch {
          errorCount++;
        }

        if (tags.Images) {
          delete tags.Images;
        }

        mediaFiles.push({
          filename: file.name,
          path: this.loc,
          tags,
        });
      } else {
        skippedCount++;
      }
    }
    prog.stop();
    mediaFiles.forEach((mediaFile) => {
      this.map[mediaFile.filename] = { clips: [], keywords: [], mediaFile };
    });
    clack.log.warn(
      `Initialized. ${mediaFiles.length} media files, ${skippedCount} skipped, ${errorCount} errors`,
    );
  }

  public async write() {
    const dbp = join(this.loc, this.DB_JSON);

    await writeFile(
      dbp,
      JSON.stringify(this.map, null, 2).concat("\n"),
      "utf-8",
    );
    clack.log.success(`Saved ${dbp}.`);
  }
}
