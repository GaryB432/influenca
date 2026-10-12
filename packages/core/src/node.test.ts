import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Manifest, MANIFEST_FILENAME } from "./manifest.js";
import { readManifest, updateEntry } from "./node.js";

describe("updateEntry", () => {
  const manifest: Manifest = {
    createdAt: "2059-05-20T00:00:00.000Z",
    entries: [
      {
        bytes: 1,
        frameCount: 1,
        id: "1",
        kind: "image",
        metaSource: "estimated",
        outputName: "a.jpg",
        sourceName: "a.jpg",
      },
      {
        bytes: 2,
        frameCount: 1,
        id: "2",
        kind: "image",
        metaSource: "estimated",
        outputName: "b.jpg",
        sourceName: "b.jpg",
      },
    ],
    version: 2,
  };
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "influenca-"));
    await writeFile(
      join(dir, MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2),
    );
  });
  afterEach(() => rm(dir, { force: true, recursive: true }));

  it("marks the one entry and leaves the rest of the manifest as it was", async () => {
    await updateEntry(dir, "2", { deleted: true });
    expect(await readManifest(dir)).toEqual({
      ...manifest,
      entries: [manifest.entries[0], { ...manifest.entries[1], deleted: true }],
    });
    expect(await readdir(dir)).toEqual([MANIFEST_FILENAME]);
  });

  it("restores to exactly the manifest accession wrote", async () => {
    await updateEntry(dir, "2", { deleted: true });
    await updateEntry(dir, "2", { deleted: false });
    expect(await readManifest(dir)).toEqual(manifest);
  });

  it("gives an entry a title, trimmed, and keeps the name it has on disk", async () => {
    await updateEntry(dir, "1", { title: "  running-unit-tests " });
    expect((await readManifest(dir)).entries[0]).toEqual({
      ...manifest.entries[0],
      title: "running-unit-tests",
    });
  });

  it("keeps a title and a delete mark side by side", async () => {
    await updateEntry(dir, "2", { title: "blurry" });
    await updateEntry(dir, "2", { deleted: true });
    expect((await readManifest(dir)).entries[1]).toMatchObject({
      deleted: true,
      outputName: "b.jpg",
      title: "blurry",
    });
  });

  it("takes the title off when it is blanked, back to the manifest accession wrote", async () => {
    await updateEntry(dir, "1", { title: "running-unit-tests" });
    await updateEntry(dir, "1", { title: "   " });
    expect(await readManifest(dir)).toEqual(manifest);
  });

  it("reads a manifest saved when the title was called name, and saves it as title", async () => {
    const old = structuredClone(manifest) as Manifest & {
      entries: { name?: string }[];
    };
    old.entries[0]!.name = "from before";
    await writeFile(join(dir, MANIFEST_FILENAME), JSON.stringify(old));

    expect((await readManifest(dir)).entries[0]).toMatchObject({
      title: "from before",
    });
    await updateEntry(dir, "2", { deleted: true });
    const saved = JSON.parse(
      await readFile(join(dir, MANIFEST_FILENAME), "utf8"),
    ) as { entries: Record<string, unknown>[] };
    expect(saved.entries[0]).toMatchObject({ title: "from before" });
    expect(saved.entries[0]).not.toHaveProperty("name");
  });

  describe("a run from when analyze and transcribe kept files of their own", () => {
    const heard = {
      language: "english",
      model: "whisper-1",
      status: "done",
      vttName: "a.vtt",
      words: 12,
    };
    const apart = async (version: number) => {
      await writeFile(
        join(dir, MANIFEST_FILENAME),
        JSON.stringify({ ...manifest, version }),
      );
      await writeFile(
        join(dir, ".influenca.analysis.json"),
        JSON.stringify({
          createdAt: "2059-05-20T01:00:00.000Z",
          entries: { 1: { stillSec: 4 } },
          version: 1,
        }),
      );
      await writeFile(
        join(dir, ".influenca.transcripts.json"),
        JSON.stringify({
          createdAt: "2059-05-20T00:30:00.000Z",
          entries: { 2: heard },
          version: 1,
        }),
      );
    };

    it("is read with what those files held on its entries", async () => {
      await apart(1);
      expect(await readManifest(dir)).toEqual({
        ...manifest,
        analyzedAt: "2059-05-20T01:00:00.000Z",
        entries: [
          { ...manifest.entries[0], analysis: { stillSec: 4 } },
          { ...manifest.entries[1], transcript: heard },
        ],
      });
    });

    it("is saved whole in the new form by its next save, and the old files are left where they are", async () => {
      await apart(1);
      await updateEntry(dir, "1", { title: "Agnes" });
      const saved = JSON.parse(
        await readFile(join(dir, MANIFEST_FILENAME), "utf8"),
      ) as Manifest;
      expect(saved.version).toBe(2);
      expect(saved.entries[0]).toMatchObject({
        analysis: { stillSec: 4 },
        title: "Agnes",
      });
      expect(saved.entries[1]).toMatchObject({ transcript: heard });
      expect((await readdir(dir)).toSorted()).toEqual([
        ".influenca.analysis.json",
        MANIFEST_FILENAME,
        ".influenca.transcripts.json",
      ]);
    });

    it("has those files passed over once it is in the new form", async () => {
      await apart(2);
      expect(await readManifest(dir)).toEqual(manifest);
    });
  });

  it("rejects an id the run does not have, changing nothing", async () => {
    await expect(updateEntry(dir, "9", { deleted: true })).rejects.toThrow(
      /No entry 9/,
    );
    expect(await readManifest(dir)).toEqual(manifest);
  });
});
