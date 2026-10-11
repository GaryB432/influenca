import { describe, expect, it } from "vitest";

import { classify, planEntries } from "./entries.js";

describe("classify", () => {
  it("is case-insensitive and rejects unknown types", () => {
    expect(classify("CLIP.AVI")?.kind).toBe("video");
    expect(classify("take.wav")?.kind).toBe("audio");
    expect(classify("notes.txt")).toBeUndefined();
  });

  it("rewraps mov as mp4", () => {
    expect(classify("IMG_0010.MOV")).toEqual({
      convertTo: ".mp4",
      kind: "video",
      rewrap: true,
    });
  });
});

describe("planEntries", () => {
  it("builds typed, estimated entries and skips unsupported files", () => {
    const entries = planEntries([
      { bytes: 2_000_000, name: "b.avi" },
      { bytes: 10, name: "readme.txt" },
      { bytes: 500, name: "a.jpg" },
      { bytes: 352_800, name: "voice.wav" },
    ]);
    expect(entries.map((e) => e.sourceName)).toEqual([
      "a.jpg",
      "b.avi",
      "voice.wav",
    ]);

    const [image, video, audio] = entries;
    expect(image).toMatchObject({ frameCount: 1, kind: "image" });
    expect(video).toMatchObject({
      durationSec: 2,
      fps: 30,
      frameCount: 60,
      kind: "video",
    });
    expect(audio).toMatchObject({ durationSec: 2, kind: "audio" });
    expect(entries.every((e) => e.metaSource === "estimated")).toBe(true);
  });

  it("assigns sequential ids", () => {
    const entries = planEntries([
      { bytes: 1, name: "x.mp4" },
      { bytes: 1, name: "y.mp4" },
    ]);
    expect(entries.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("throws on case-insensitive output collisions", () => {
    expect(() =>
      planEntries([
        { bytes: 1, name: "clip.mp4" },
        { bytes: 1, name: "CLIP.MP4" },
      ]),
    ).toThrow(/collision/);
  });
});
