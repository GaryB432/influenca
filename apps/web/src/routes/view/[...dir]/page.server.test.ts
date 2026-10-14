import { MANIFEST_FILENAME, type Manifest } from "@influenca/core";
import { readManifest } from "@influenca/core/node";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { actions } from "./+page.server.js";

describe("update", () => {
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
    ],
    version: 1,
  };
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "influenca-"));
    process.env.INFLUENCA_MEDIA_DIR = root;
    await mkdir(join(root, "run"));
    await writeFile(
      join(root, "run", MANIFEST_FILENAME),
      JSON.stringify(manifest, null, 2),
    );
  });
  afterEach(() => rm(root, { force: true, recursive: true }));

  /** Posts a form to the action the way the page does. */
  function post(fields: Record<string, string>) {
    const url = new URL("http://localhost/view/run?/update");
    const request = new Request(url, {
      body: new URLSearchParams(fields),
      method: "POST",
    });
    // The action reads only these three.
    return actions.update({ params: { dir: "run" }, request, url } as never);
  }

  it("splits the tags field on commas", async () => {
    await post({ id: "1", tags: "drone, interview,,drone , " });
    expect((await readManifest(join(root, "run"))).entries[0]?.tags).toEqual([
      "drone",
      "interview",
    ]);
  });

  it("removes the tags when the field is emptied", async () => {
    await post({ id: "1", tags: "drone" });
    await post({ id: "1", tags: "" });
    expect((await readManifest(join(root, "run"))).entries[0]).not.toHaveProperty(
      "tags",
    );
  });
});
