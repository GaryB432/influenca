import * as fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

const openAiCreate = vi.fn();

const ffmpegMockInstance = {
  audioBitrate: vi.fn().mockReturnThis(),
  audioChannels: vi.fn().mockReturnThis(),
  audioCodec: vi.fn().mockReturnThis(),
  noVideo: vi.fn().mockReturnThis(),
  on: vi.fn(function (
    this: unknown,
    event: string,
    handler: (...args: unknown[]) => void,
  ) {
    if (event === "end") {
      queueMicrotask(() => handler());
    }
    return this;
  }),
  output: vi.fn().mockReturnThis(),
  outputOptions: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

vi.mock("fluent-ffmpeg", () => ({
  default: Object.assign(
    vi.fn(() => ffmpegMockInstance),
    {
      ffprobe: vi.fn(),
    },
  ),
}));

vi.mock("openai", () => ({
  default: class {
    audio = {
      transcriptions: {
        create: openAiCreate,
      },
    };

    constructor() {}
  },
}));

import { transcribeAudio } from "./accession";

describe("transcribeAudio", () => {
  it("returns undefined when the transcription request fails instead of hanging", async () => {
    fs.writeFileSync("/tmp/scratch.mp3", "fake-audio");
    openAiCreate.mockRejectedValue(new Error("Connection error."));

    const result = await Promise.race([
      transcribeAudio(
        {
          dryRun: false,
          inDir: "/tmp/in",
          meter: () => ({
            advance: () => {},
            start: () => {},
            stop: () => {},
          }),
          openAiKey: "test-key",
          outDir: "/tmp/out",
          stitch: true,
          transcribe: true,
          verbose: false,
        },
        "/tmp/input.mp4",
        "/tmp/scratch.mp3",
      ),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timed out")), 200);
      }),
    ]);

    expect(result).toBeUndefined();
  });
});
