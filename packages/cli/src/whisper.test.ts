import { describe, expect, it } from "vitest";

import { errorMessage, toVtt } from "./whisper.js";

describe("errorMessage", () => {
  it("reads the message out of an OpenAI error body", () => {
    expect(errorMessage('{"error":{"message":"File is too large."}}')).toBe(
      "File is too large.",
    );
  });

  it("falls back to the body when it is not one", () => {
    expect(errorMessage("<html>502 Bad Gateway</html>\n")).toBe(
      "<html>502 Bad Gateway</html>",
    );
  });
});

describe("toVtt", () => {
  it("writes a cue per segment", () => {
    expect(
      toVtt([
        { end: 2.5, start: 0, text: " Hello." },
        { end: 3661.5, start: 3600, text: " Still here." },
      ]),
    ).toBe(
      "WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHello.\n\n01:00:00.000 --> 01:01:01.500\nStill here.\n",
    );
  });

  it("is a bare header when nothing was said", () => {
    expect(toVtt([])).toBe("WEBVTT\n");
  });
});
