import { expect, test } from "vitest";

import { videoCaptionPath, videoSrcPath } from "./names.js";

test("gets video source path", () => {
  expect(videoSrcPath("fun")).toEqual("cloud/fun.mp4");
});

test("gets video caption path", () => {
  expect(videoCaptionPath("fun")).toEqual("cloud/fun.track.json");
});
