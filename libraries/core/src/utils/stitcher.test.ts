import { describe, expect, it } from "vitest";

import type { Manifest } from "..";

import { isNear, locate_candidates_low_level } from "./stitcher";

describe("isNear", () => {
  it("alpha", () => {
    expect(isNear(5, 10)).toBeFalsy();
  });
  it("bravo", () => {
    expect(isNear(5, 5)).toBeTruthy();
  });
  it("charlie", () => {
    expect(isNear(5, 10, 6)).toBeTruthy();
  });
  it("delta", () => {
    expect(isNear(60, 59, 1)).toBeTruthy();
  });
});

describe("stitcher", () => {
  it("should get fragments", async () => {
    const reslt = Object.values(
      await locate_candidates_low_level(some_manifest),
    ).map((g) => g.name);
    expect(reslt.toSorted()).toEqual([
      "V01_FUN_59.mp4",
      "V04_MORE_LIKE_60.mp4",
      "V05.mp4",
      "V07.mp4",
      "V08.mp4",
      "V09_IS_ONLY_59.mp4",
    ]);

    expect(reslt).not.toContain("TWELVE_SECONDS_OVER.mp4");
  });

  it("should disallow extra media", async () => {
    await expect(
      locate_candidates_low_level({
        V02: {
          transcript: undefined,
          video: {
            "V02.mp4": {
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
        V04: {
          transcript: undefined,
          video: {
            "V04.mp4": {
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
  V01: {
    transcript: undefined,
    video: {
      "V01_FUN_59.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },

  V02: {
    transcript: undefined,
    video: {
      "V02.mp4": {
        stats: {
          duration_seconds: 590,
          frames: 17990,
        },
      },
    },
  },
  V04: {
    transcript: undefined,
    video: {
      "V04_MORE_LIKE_60.mp4": {
        stats: {
          duration_seconds: 60,
          frames: 1801,
        },
      },
    },
  },
  V05: {
    transcript: undefined,
    video: {
      "V05.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  V07: {
    transcript: undefined,
    video: {
      "V07.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  V08: {
    transcript: undefined,
    video: {
      "V08.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  V09: {
    transcript: undefined,
    video: {
      "V09_IS_ONLY_59.mp4": {
        stats: {
          duration_seconds: 59,
          frames: 1799,
        },
      },
    },
  },
  V10: {
    transcript: undefined,
    video: {
      "V10.mp4": {
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
