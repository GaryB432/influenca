import * as fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

import type { Manifest } from "..";

import { transcribeAudio } from "./accession";
import { stitch } from "./accession";

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

describe("stitch", () => {
  it("stitches", async () => {
    const subject = { ...some_manifest };
    const stiched = await stitch(subject);
    expect(Object.keys(stiched).length).toEqual(9);
  });
});

const some_manifest: Manifest = {
  VID00001: {
    transcript: undefined,
    video: {
      "VID00001.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },

  VID00002: {
    transcript: undefined,
    video: {
      "VID00002.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  VID00004: {
    transcript: undefined,
    video: {
      "VID00004.mp4": {
        stats: {
          duration_seconds: 60,
          frames: 1801,
        },
      },
    },
  },
  VID00005: {
    transcript: undefined,
    video: {
      "VID00005.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  VID00007: {
    transcript: undefined,
    video: {
      "VID00007.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  VID00008: {
    transcript: undefined,
    video: {
      "VID00008.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  VID00009: {
    transcript: undefined,
    video: {
      "VID00009.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  VID00010: {
    transcript: undefined,
    video: {
      "VID00010.mp4": {
        stats: {
          duration_seconds: 16,
          frames: 491,
        },
      },
    },
  },
  WHATEVER: {
    transcript: undefined,
    video: {
      "AUD00001.mp4": {
        stats: {
          duration_seconds: 72,
          frames: 1803,
        },
      },
    },
  },
};
