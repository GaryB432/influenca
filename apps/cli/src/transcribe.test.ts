import type { ManifestEntry } from "@influenca/core";

import { describe, expect, it } from "vitest";

import { vttNames } from "./transcribe.js";

const audio = (id: string, outputName: string) =>
  ({ durationSec: 1, id, kind: "audio", outputName }) as Extract<
    ManifestEntry,
    { kind: "audio" }
  >;

describe("vttNames", () => {
  it("names a transcript after its file", () => {
    expect([...vttNames([audio("1", "AUD00000.mp3")]).values()]).toEqual([
      "AUD00000.vtt",
    ]);
  });

  it("keeps the extension of a later file with the same stem", () => {
    const names = vttNames([audio("1", "a.mp3"), audio("2", "A.mp4")]);
    expect(Object.fromEntries(names)).toEqual({ 1: "a.vtt", 2: "A.mp4.vtt" });
  });
});
