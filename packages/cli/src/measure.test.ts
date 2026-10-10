import { describe, expect, it } from "vitest";

import { detectedSec } from "./measure.js";

describe("detectedSec", () => {
  it("totals the stretches ffmpeg reports", () => {
    const log = [
      "[silencedetect @ 0x1] silence_start: 0.0041875",
      "[silencedetect @ 0x1] silence_end: 1.87031 | silence_duration: 1.86613",
      "[silencedetect @ 0x1] silence_start: 3.89363",
      "[silencedetect @ 0x1] silence_end: 5.5 | silence_duration: 1.60637",
    ].join("\n");
    expect(detectedSec(log, "silence_", 10)).toBe(3.473);
  });

  it("runs a stretch still open at the end out to the end", () => {
    const log = "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 4";
    expect(detectedSec(log, "freeze_", 10)).toBe(6);
  });

  it("is zero when nothing was detected, and ignores the other detector", () => {
    const log = "[silencedetect @ 0x1] silence_end: 2 | silence_duration: 2";
    expect(detectedSec(log, "freeze_", 10)).toBe(0);
  });
});
