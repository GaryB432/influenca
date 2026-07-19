import assert from "node:assert";
import { test } from "node:test";
import { getExtremelyFoundationalSegmentCount, type VttThingWithStuffIncludingTheSegments } from "./analyze.js";

test("transcribes basics", () => {
  assert.equal(getExtremelyFoundationalSegmentCount(transcribe_specimen), 5);
});

const transcribe_specimen :VttThingWithStuffIncludingTheSegments= {
  duration: 60.40999984741211,
  language: "english",
  segments: [
    {
      avg_logprob: -0.403396874666214,
      compression_ratio: 1.236842155456543,
      end: 5,
      id: 0,
      no_speech_prob: 0.007178138941526413,
      seek: 0,
      start: 0,
      temperature: 0,
      text: " Welcome to my video processing hobby project.",
      tokens: [50364, 4027, 281, 452, 960, 9007, 18240, 1716, 13, 50614],
    },
    {
      avg_logprob: -0.403396874666214,
      compression_ratio: 1.236842155456543,
      end: 9.920000076293945,
      id: 1,
      no_speech_prob: 0.007178138941526413,
      seek: 0,
      start: 8.380000114440918,
      temperature: 0,
      text: " I call it Influenza.",
      tokens: [50783, 286, 818, 309, 11537, 2781, 23691, 13, 50860],
    },
    {
      avg_logprob: -0.403396874666214,
      compression_ratio: 1.236842155456543,
      end: 13.640000343322754,
      id: 2,
      no_speech_prob: 0.007178138941526413,
      seek: 0,
      start: 11.0600004196167,
      temperature: 0,
      text: " You know, it's like influenza, only influencer.",
      tokens: [
        50917, 509, 458, 11, 309, 311, 411, 36408, 11, 787, 39503, 13, 51046,
      ],
    },
    {
      avg_logprob: -0.403396874666214,
      compression_ratio: 1.236842155456543,
      end: 18.200000762939453,
      id: 3,
      no_speech_prob: 0.007178138941526413,
      seek: 0,
      start: 16.899999618530273,
      temperature: 0,
      text: " Let me turn this light on.",
      tokens: [51209, 961, 385, 1261, 341, 1442, 322, 13, 51274],
    },
    {
      avg_logprob: -0.4508180618286133,
      compression_ratio: 1.1739130020141602,
      end: 42.880001068115234,
      id: 4,
      no_speech_prob: 0.001245618797838688,
      seek: 3000,
      start: 30,
      temperature: 0,
      text: " Hmm, what does this look like?",
      tokens: [50364, 8239, 11, 437, 775, 341, 574, 411, 30, 51008],
    },
    {
      avg_logprob: -0.4508180618286133,
      compression_ratio: 1.1739130020141602,
      end: 52.70000076293945,
      id: 5,
      no_speech_prob: 0.001245618797838688,
      seek: 3000,
      start: 42.880001068115234,
      temperature: 0,
      text: " It is 8.43pm, Saturday, July 18th.",
      tokens: [
        51008, 467, 307, 1649, 13, 17201, 14395, 11, 8803, 11, 7370, 2443, 392,
        13, 51499,
      ],
    },
    {
      avg_logprob: -0.4508180618286133,
      compression_ratio: 1.1739130020141602,
      end: 56.91999816894531,
      id: 6,
      no_speech_prob: 0.001245618797838688,
      seek: 3000,
      start: 52.70000076293945,
      temperature: 0,
      text: " I've got these lights on and the under the counter kitchen lights on.",
      tokens: [
        51499, 286, 600, 658, 613, 5811, 322, 293, 264, 833, 264, 5682, 6525,
        5811, 322, 13, 51710,
      ],
    },
    {
      avg_logprob: -0.5664069056510925,
      compression_ratio: 0.8139534592628479,
      end: 58.20000076293945,
      id: 7,
      no_speech_prob: 0.03720948472619057,
      seek: 5692,
      start: 56.91999816894531,
      temperature: 0,
      text: " It seems like that's going to work.",
      tokens: [50364, 467, 2544, 411, 300, 311, 516, 281, 589, 13, 50428],
    },
  ],
  task: "transcribe",
  text: "Welcome to my video processing hobby project. I call it Influenza. You know, it's like influenza, only influencer. Let me turn this light on. Hmm, what does this look like? It is 8.43pm, Saturday, July 18th. I've got these lights on and the under the counter kitchen lights on. It seems like that's going to work.",
  usage: { seconds: 61, type: "duration" },
};

console.log(transcribe_specimen.segments.length);
