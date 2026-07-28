import { expect, test } from "vitest";

import { type Transcription } from "../index";
import { getExtremelyFoundationalSegmentCount } from "./analyze";

test("transcribes basics", () => {
  expect(getExtremelyFoundationalSegmentCount(transcribe_specimen)).toEqual(1);
});

const transcribe_specimen: Transcription = {
  duration: 0,
  language: "",
  segments: [
    {
      avg_logprob: 0,
      compression_ratio: 0,
      end: 0,
      id: 0,
      no_speech_prob: 0,
      seek: 0,
      start: 0,
      temperature: 0,
      text: "",
      tokens: [],
    },
  ],
  text: "",
};
