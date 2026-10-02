import { describe, expect, it } from "vitest";

import type { Manifest } from "..";

import { locate_candidates_low_level } from "./stitcher";

describe("oven", () => {
  it("should get fragments", async () => {
    const cands = await locate_candidates_low_level(some_manifest);
    expect(cands).toMatchInlineSnapshot(`
      {
        "VID00001": {
          "duration_seconds": 59,
          "frames": 1799,
          "name": "VID00001_FUN_59.mp4",
        },
        "VID00004": {
          "duration_seconds": 60,
          "frames": 1801,
          "name": "VID00004_MORE_LIKE_60.mp4",
        },
        "VID00005": {
          "duration_seconds": 59,
          "frames": 1799,
          "name": "VID00005.mp4",
        },
        "VID00007": {
          "duration_seconds": 59,
          "frames": 1799,
          "name": "VID00007.mp4",
        },
        "VID00008": {
          "duration_seconds": 59,
          "frames": 1799,
          "name": "VID00008.mp4",
        },
        "VID00009": {
          "duration_seconds": 59,
          "frames": 1799,
          "name": "VID00009_IS_ONLY_59.mp4",
        },
      }
    `);
  });

  it("should disallow extra media", async () => {
    await expect(
      locate_candidates_low_level({
        VID00002: {
          transcript: undefined,
          video: {
            "VID00002.mp4": {
              stats: {
                duration_seconds: 590,
                frames: 17990,
              },
            },
            "WHERE_DID_THIS_COME_FROM.mp4": {
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
      }),
    ).rejects.toThrow("one video only for now");
  });
});

const some_manifest: Manifest = {
  VID00001: {
    transcript: undefined,
    video: {
      "VID00001_FUN_59.mp4": {
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
      "VID00004_MORE_LIKE_60.mp4": {
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
      "VID00009_IS_ONLY_59.mp4": {
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
      "TWELVE_SECONDS_OVER.mp4": {
        stats: {
          duration_seconds: 72,
          frames: 1803,
        },
      },
    },
  },
};
