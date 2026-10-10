import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readJSON } from "./json.js";

describe("readJSON", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "influenca-"));
  });
  afterEach(() => rm(dir, { force: true, recursive: true }));

  it("parses a typed file", async () => {
    const path = join(dir, "a.json");
    await writeFile(path, JSON.stringify({ n: 1 }));
    expect(await readJSON<{ n: number }>(path)).toEqual({ n: 1 });
  });

  it("rejects when the file is missing", async () => {
    await expect(readJSON(join(dir, "nope.json"))).rejects.toThrow();
  });
});
