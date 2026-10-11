import type { Manifest } from "@influenca/core";

import { MANIFEST_FILENAME, TRANSCRIPTS_FILENAME } from "@influenca/core";
import { updateEntry } from "@influenca/core/node";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fileName, runExport } from "./export.js";

describe("fileName", () => {
  it("leaves a tidy name alone", () => {
    expect(fileName("pool-b-roll")).toBe("pool-b-roll");
  });

  it("makes anything typed into something a folder will take", () => {
    expect(fileName('  Uncle Bob & "the grill" <3  ')).toBe(
      "Uncle-Bob-&-the-grill-3",
    );
    expect(fileName("a/b\\c: d?")).toBe("a-b-c-d");
    expect(fileName("...trailing. ")).toBe("trailing");
  });
});

describe("runExport", () => {
  let root: string;
  let run: string;
  let to: string;
  const image = (id: string, outputName: string) => ({
    bytes: 4,
    frameCount: 1 as const,
    id,
    kind: "image" as const,
    metaSource: "estimated" as const,
    outputName,
    sourceName: outputName,
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "influenca-"));
    run = join(root, "run");
    to = join(root, "projects", "garden-party");
    const manifest: Manifest = {
      createdAt: "2059-05-20T00:00:00.000Z",
      entries: [
        image("1", "PXL_1.JPG"),
        image("2", "PXL_2.jpg"),
        image("3", "PXL_3.jpg"),
        image("4", "PXL_4.jpg"),
      ],
      version: 1,
    };
    await mkdir(run);
    await writeFile(join(run, MANIFEST_FILENAME), JSON.stringify(manifest));
    for (const e of manifest.entries) {
      await writeFile(join(run, e.outputName), `pic${e.id}`);
    }
    await writeFile(join(run, "PXL_1.vtt"), "WEBVTT\n");
    await writeFile(
      join(run, TRANSCRIPTS_FILENAME),
      JSON.stringify({
        createdAt: manifest.createdAt,
        entries: {
          1: {
            language: "english",
            model: "whisper-1",
            status: "done",
            vttName: "PXL_1.vtt",
            words: 0,
          },
        },
        version: 1,
      }),
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { force: true, recursive: true });
  });

  it("copies the named files under their names, with subtitles, and leaves the rest", async () => {
    await updateEntry(run, "1", { name: "pool b-roll" });
    await updateEntry(run, "2", { name: "blurry" });
    await updateEntry(run, "2", { deleted: true });
    await updateEntry(run, "3", { name: "cake" });

    await runExport({ inDir: run, to });

    expect((await readdir(to)).toSorted()).toEqual([
      "cake.jpg",
      "pool-b-roll.jpg",
      "pool-b-roll.vtt",
    ]);
    expect(await readFile(join(to, "pool-b-roll.jpg"), "utf8")).toBe("pic1");
    // The run still has everything, under the names it had.
    expect(await readdir(run)).toContain("PXL_1.JPG");
  });

  it("copies only the ones asked for", async () => {
    await updateEntry(run, "3", { name: "cake" });
    await updateEntry(run, "4", { name: "candles" });
    await runExport({ inDir: run, only: ["4"], to });
    expect(await readdir(to)).toEqual(["candles.jpg"]);
  });

  it("does not write over a file that is already there", async () => {
    await updateEntry(run, "3", { name: "cake" });
    await runExport({ inDir: run, to });
    await writeFile(join(to, "cake.jpg"), "edited since");

    await updateEntry(run, "4", { name: "candles" });
    await runExport({ inDir: run, to });

    expect(await readFile(join(to, "cake.jpg"), "utf8")).toBe("edited since");
    expect(await readFile(join(to, "candles.jpg"), "utf8")).toBe("pic4");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("cake.jpg is already there"),
    );
  });

  it("says so, and makes no folder, when nothing has a name", async () => {
    await runExport({ inDir: run, to });
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Nothing has a name yet"),
    );
    await expect(readdir(to)).rejects.toThrow();
  });
});
