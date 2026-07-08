import * as clack from "@clack/prompts";
import ExifReader from "exifreader";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MediaFile, MediaMap } from "../lib/types";

const DB_JSON = ".influenca.json";
export class Database {
  readonly loc: string;
  map: MediaMap = {};
  private readonly DB_JSON = ".influenca.json";

  private constructor(loc: string) {
    this.loc = loc;
  }

  public static async tryCreate(loc: string): Promise<Database | false> {
    const dbp = join(loc, DB_JSON);
    if (existsSync(dbp)) {
      const db = new Database(loc);
      const data = await readFile(dbp, "utf-8");
      db.map = JSON.parse(data);
      return db;
    } else {
      clack.log.warn(`No Media Library at '${dbp}'`);
    }
    return false;
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
export function listMedia(db: Database): string {
  return Object.values(db.map)
    .map((m) => {
      const mediaTitle = m.mediaFile.xtitle || m.mediaFile.filename;
      m.keywords.push("test");
      return { mediaTitle, keywordString: m.keywords.join() };
    })
    .toSorted((a, b) => a.mediaTitle.localeCompare(b.mediaTitle))
    .map((m) => m.mediaTitle.concat(" > ").concat(m.keywordString))
    .join("\n");
}
