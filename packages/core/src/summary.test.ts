import { describe, expect, it } from "vitest";

import type { Manifest } from "./manifest.js";

import { formatDuration, summarize } from "./summary.js";

const base = {
  bytes: 1,
  metaSource: "estimated",
  outputName: "x",
  sourceName: "x",
} as const;

describe("summarize", () => {
  it("sums frames over video and images, duration over video and audio", () => {
    const manifest: Manifest = {
      createdAt: "2059-05-20T00:00:00Z",
      entries: [
        {
          ...base,
          durationSec: 2,
          fps: 30,
          frameCount: 60,
          id: "1",
          kind: "video",
        },
        { ...base, durationSec: 2, id: "2", kind: "audio" },
        { ...base, frameCount: 1, id: "3", kind: "image" },
      ],
      version: 2,
    };
    expect(summarize(manifest)).toEqual({
      counts: { audio: 1, image: 1, video: 1 },
      estimated: true,
      totalDurationSec: 4,
      totalFrames: 61,
    });
  });
});

describe("formatDuration", () => {
  it("formats hh:mm:ss", () => {
    expect(formatDuration(3725)).toBe("01:02:05");
  });
});
