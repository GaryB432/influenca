import type { Manifest } from "@influenca/core";

import { FcpTimeline, MANIFEST_FILENAME } from "@influenca/core";
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

vi.mock("@influenca/core", async () => {
  const actual =
    await vi.importActual<typeof import("@influenca/core")>("@influenca/core");

  return {
    ...actual,
    FcpTimeline: vi.fn(),
  };
});

import { runExport, slug } from "./export.js";

describe("slug", () => {
  it("is the title in lowercase with hyphens for spaces", () => {
    expect(slug("Pool b-roll")).toBe("pool-b-roll");
    expect(slug("Mary had a little lamb")).toBe("mary-had-a-little-lamb");
  });

  it("makes anything typed into something a folder will take", () => {
    expect(slug('  Uncle Bob & "the grill" <3  ')).toBe(
      "uncle-bob-the-grill-3",
    );
    expect(slug("Agnes, if you get it")).toBe("agnes-if-you-get-it");
    expect(slug("Café: été 2026")).toBe("café-été-2026");
  });

  it("drops emoji, which are neither letters nor numbers", () => {
    expect(slug("Agnes 👵 if you get it")).toBe("agnes-if-you-get-it");
    expect(slug("🎉🎂")).toBe("");
    expect(slug("a/b\\c: d?")).toBe("a-b-c-d");
    expect(slug("...trailing. ")).toBe("trailing");
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
    run = join(root, "some_run");
    to = join(root, "projects", "garden-party");
    const manifest: Manifest = {
      createdAt: "2059-05-20T00:00:00.000Z",
      entries: [
        {
          ...image("1", "PXL_1.JPG"),
          transcript: {
            language: "english",
            model: "whisper-1",
            status: "done",
            vttName: "PXL_1.vtt",
            words: 0,
          },
        },
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
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    await rm(root, { force: true, recursive: true });
  });

  it("calls the fcpxml timeline for every exported title", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const end = vi.fn();
    const xml = vi.fn();
    vi.mocked(FcpTimeline).mockImplementation(function () {
      return { add, end, xml } as unknown as InstanceType<typeof FcpTimeline>;
    });

    await updateEntry(run, "1", { title: "Pool b-roll" });
    await updateEntry(run, "3", { title: "cake" });

    await runExport({ inDir: run, to });

    expect(FcpTimeline).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "1",
        title: "Pool b-roll",
      }),
      expect.stringContaining("pool-b-roll"),
      expect.stringContaining("pool-b-roll.jpg"),
      // expect.stringContaining(
      //   // "/tmp/influenca-4ndUwt/projects/garden-party/pool-b-roll.jpg",
      //   run,
      // ),
      // run,
      expect.stringContaining("garden-party"),
    );
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("copies the titled files under names made from their titles, and leaves the rest", async () => {
    await updateEntry(run, "1", { title: "Pool b-roll" });
    await updateEntry(run, "2", { title: "blurry" });
    await updateEntry(run, "2", { deleted: true });
    await updateEntry(run, "3", { title: "cake" });

    await runExport({ inDir: run, to });

    expect((await readdir(to)).toSorted()).toEqual([
      "cake.jpg",
      "pool-b-roll.jpg",
      // No .vtt by default — VLC would auto-show it as captions otherwise.
    ]);
    expect(await readFile(join(to, "pool-b-roll.jpg"), "utf8")).toBe("pic1");
    // The run still has everything, under the names it had.
    expect(await readdir(run)).toContain("PXL_1.JPG");
  });

  it("copies the subtitle .vtt alongside the video when subtitles: true", async () => {
    await updateEntry(run, "1", { title: "Pool b-roll" });
    await updateEntry(run, "3", { title: "cake" });

    await runExport({ inDir: run, subtitles: true, to });

    expect((await readdir(to)).toSorted()).toEqual([
      "cake.jpg",
      "pool-b-roll.jpg",
      "pool-b-roll.vtt",
    ]);
  });

  it("keeps the file's own name when the title has nothing to make one from", async () => {
    await updateEntry(run, "3", { title: "🎉🎂" });
    await runExport({ inDir: run, to });
    expect(await readdir(to)).toEqual(["PXL_3.jpg"]);
  });

  it("copies only the ones asked for", async () => {
    await updateEntry(run, "3", { title: "cake" });
    await updateEntry(run, "4", { title: "candles" });
    await runExport({ inDir: run, only: ["4"], to });
    expect(await readdir(to)).toEqual(["candles.jpg"]);
  });

  it("copies only the titled files with the tag asked for", async () => {
    await updateEntry(run, "1", { tags: ["drone"], title: "Pool b-roll" });
    await updateEntry(run, "3", { tags: ["drone", "cake"], title: "cake" });
    await updateEntry(run, "4", { title: "candles" });
    // Tagged but untitled, so not picked.
    await updateEntry(run, "2", { tags: ["drone"] });
    await runExport({ inDir: run, tag: "drone", to });
    expect((await readdir(to)).toSorted()).toEqual([
      "cake.jpg",
      "pool-b-roll.jpg",
    ]);
  });

  it("says so, and makes no folder, when nothing titled has the tag", async () => {
    await updateEntry(run, "3", { title: "cake" });
    await runExport({ inDir: run, tag: "drone", to });
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Nothing titled is tagged drone"),
    );
    await expect(readdir(to)).rejects.toThrow();
  });

  it("does not write over a file that is already there", async () => {
    await updateEntry(run, "3", { title: "cake" });
    await runExport({ inDir: run, to });
    await writeFile(join(to, "cake.jpg"), "edited since");

    await updateEntry(run, "4", { title: "candles" });
    await runExport({ inDir: run, to });

    expect(await readFile(join(to, "cake.jpg"), "utf8")).toBe("edited since");
    expect(await readFile(join(to, "candles.jpg"), "utf8")).toBe("pic4");
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("cake.jpg is already there"),
    );
  });

  it("says so, and makes no folder, when nothing has a title", async () => {
    await runExport({ inDir: run, to });
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Nothing has a title yet"),
    );
    await expect(readdir(to)).rejects.toThrow();
  });
});
