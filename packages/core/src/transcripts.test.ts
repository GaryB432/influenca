import { describe, expect, it } from "vitest";

import { vttText } from "./transcripts.js";

describe("vttText", () => {
  it("keeps the words and drops the header and timings", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:07.000",
      "Here I am in the car with a",
      "",
      "00:00:07.000 --> 00:00:08.000",
      "nice shave.",
      "",
    ].join("\r\n");
    expect(vttText(vtt)).toBe("Here I am in the car with a nice shave.");
  });

  it("is empty for a transcript with no cues", () => {
    expect(vttText("WEBVTT\n")).toBe("");
  });
});
