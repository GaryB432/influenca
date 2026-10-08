import * as fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

const openAiCreate = vi.fn();

vi.mock("./ffmpeg.js", () => ({
  runFfmpeg: vi.fn().mockResolvedValue(""),
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

import { formatSummary, transcribeAudio } from "./accession";

describe("formatSummary", () => {
  it("points at analyze as the next step", () => {
    expect(
      formatSummary({
        failedFiles: 0,
        manifestPath: "",
        matchedFiles: 0,
        outDir: "",
        processedFiles: 0,
        transcribedFiles: 0,
      }),
    ).toMatch(/analyze/);
  });
});

describe("transcribeAudio", () => {
  it("returns undefined when the transcription request fails instead of hanging", async () => {
    fs.writeFileSync("/tmp/scratch.mp3", "fake-audio");
    openAiCreate.mockRejectedValue(new Error("Connection error."));

    const result = await Promise.race([
      transcribeAudio(
        {
          dryRun: false,
          inDir: "/tmp/in",
          openAiKey: "test-key",
          outDir: "/tmp/out",
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
