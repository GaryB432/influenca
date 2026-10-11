import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Manifest, MANIFEST_FILENAME } from "./manifest.js";
import { curate, readManifest } from "./node.js";

describe("curate", () => {
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
    version: 1,
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
    await curate(dir, "2", { deleted: true });
    expect(await readManifest(dir)).toEqual({
      ...manifest,
      entries: [manifest.entries[0], { ...manifest.entries[1], deleted: true }],
    });
    expect(await readdir(dir)).toEqual([MANIFEST_FILENAME]);
  });

  it("restores to exactly the manifest accession wrote", async () => {
    await curate(dir, "2", { deleted: true });
    await curate(dir, "2", { deleted: false });
    expect(await readManifest(dir)).toEqual(manifest);
  });

  it("names an entry, trimmed, and keeps the name it has on disk", async () => {
    await curate(dir, "1", { name: "  running-unit-tests " });
    expect((await readManifest(dir)).entries[0]).toEqual({
      ...manifest.entries[0],
      name: "running-unit-tests",
    });
  });

  it("keeps a name and a delete mark side by side", async () => {
    await curate(dir, "2", { name: "blurry" });
    await curate(dir, "2", { deleted: true });
    expect((await readManifest(dir)).entries[1]).toMatchObject({
      deleted: true,
      name: "blurry",
      outputName: "b.jpg",
    });
  });

  it("takes the name off when it is blanked, back to the manifest accession wrote", async () => {
    await curate(dir, "1", { name: "running-unit-tests" });
    await curate(dir, "1", { name: "   " });
    expect(await readManifest(dir)).toEqual(manifest);
  });

  it("rejects an id the run does not have, changing nothing", async () => {
    await expect(curate(dir, "9", { deleted: true })).rejects.toThrow(
      /No entry 9/,
    );
    expect(await readManifest(dir)).toEqual(manifest);
  });
});
