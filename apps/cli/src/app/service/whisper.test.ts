import { describe, expect, it } from "vitest";

import {
  createTranscriber,
  errorMessage,
  localModelPath,
  toVtt,
} from "./whisper.js";

describe("createTranscriber", () => {
  it("keeps OpenAI as the default provider", () => {
    expect(
      createTranscriber(undefined, { OPENAI_API_KEY: "test-key" }),
    ).toMatchObject({ model: "whisper-1", name: "openai" });
  });

  it("selects the configured local provider and model cache", () => {
    const selection = createTranscriber(undefined, {
      INFLUENCA_TRANSCRIBER: "local",
      XDG_DATA_HOME: "/home/test/data",
    });
    expect(selection).toMatchObject({
      model: "ggml-base.en.bin",
      name: "local",
    });
    expect(localModelPath({ XDG_DATA_HOME: "/home/test/data" })).toBe(
      "/home/test/data/influenca/models/ggml-base.en.bin",
    );
  });

  it("fails clearly when a local model is missing", async () => {
    const { transcriber } = createTranscriber("local", {
      INFLUENCA_WHISPER_MODEL: "/missing/model.bin",
    });
    await expect(
      transcriber.transcribe("unused", {
        durationSec: 1,
        onProgress: () => {},
      }),
    ).rejects.toThrow(/Local Whisper model not found at \/missing\/model\.bin/);
  });

  it("requires a key only for the OpenAI provider", () => {
    expect(() => createTranscriber("openai", {})).toThrow(
      "Set OPENAI_API_KEY in .env to transcribe with OpenAI.",
    );
  });

  it("rejects an unknown provider instead of silently changing backends", () => {
    expect(() => createTranscriber("other", {})).toThrow(
      'Unknown transcriber "other"; choose openai or local.',
    );
  });
});

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
