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
    await updateEntry(dir, "2", { deleted: true });
    expect(await readManifest(dir)).toEqual({
      ...manifest,
      entries: [manifest.entries[0], { ...manifest.entries[1], deleted: true }],
    });
    const saved = JSON.parse(
      await readFile(join(dir, MANIFEST_FILENAME), "utf8"),
    ) as Record<string, unknown>;
    expect(saved.version).toBe(1);
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

  it("ignores legacy sidecar files", async () => {
    await writeFile(
      join(dir, ".influenca.analysis.json"),
      JSON.stringify({ entries: { 1: { stillSec: 4 } } }),
    );
    await writeFile(
      join(dir, ".influenca.transcripts.json"),
      JSON.stringify({ entries: { 1: { status: "silent" } } }),
    );

    expect(await readManifest(dir)).toEqual(manifest);
  });

  it("rejects a manifest with an unsupported version", async () => {
    await writeFile(
      join(dir, MANIFEST_FILENAME),
      JSON.stringify({ ...manifest, version: 2 }),
    );

    await expect(readManifest(dir)).rejects.toThrow(/version 1 manifest/);
  });

  it("rejects a manifest without a version", async () => {
    const withoutVersion: Record<string, unknown> = { ...manifest };
    delete withoutVersion.version;
    await writeFile(
      join(dir, MANIFEST_FILENAME),
      JSON.stringify(withoutVersion),
    );

    await expect(readManifest(dir)).rejects.toThrow(/version 1 manifest/);
  });

  it("rejects an id the run does not have, changing nothing", async () => {
    await expect(updateEntry(dir, "9", { deleted: true })).rejects.toThrow(
      /No entry 9/,
    );
    expect(await readManifest(dir)).toEqual(manifest);
  });
});
