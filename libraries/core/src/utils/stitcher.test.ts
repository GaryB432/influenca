import { describe, expect, it } from "vitest";

import type { Manifest } from "..";

import { findem } from "./stitcher";

describe("oven", () => {
  it("should add", async () => {
    const cands = await findem(some_manifest);
    expect(Object.keys(cands)).toEqual([
      "VID00001",
      "VID00004",
      "VID00005",
      "VID00007",
      "VID00008",
      "VID00009",
    ]);
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
          duration_seconds: 590,
          frames: 17990,
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
