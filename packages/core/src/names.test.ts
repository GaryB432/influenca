import assert from "node:assert";
import { test } from "node:test";

import { videoCaptionPath, videoSrcPath } from "./names.js";

test("gets video source path", () => {
  assert.equal(videoSrcPath("fun"), "cloud/fun.mp4");
});

test("gets video caption path", () => {
  assert.equal(videoCaptionPath("fun"), "cloud/fun.track.json");
});

