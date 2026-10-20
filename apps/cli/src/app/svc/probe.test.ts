import { describe, expect, it } from "vitest";

import { planEntries } from "../utils/entries.js";
import { applyProbe, type ProbeOutput } from "./probe.js";

const [jpgImage, pngImage, video, audio] = planEntries([
  { bytes: 500, name: "a.jpg" },
  { bytes: 500, name: "a.png" },
  { bytes: 2_000_000, name: "b.avi" },
  { bytes: 352_800, name: "c.wav" },
]);

const pcm = {
  channels: 1,
  codec_name: "pcm_s16le",
  codec_type: "audio",
  sample_rate: "16000",
};
const mjpeg = {
  codec_name: "mjpeg",
  codec_type: "video",
  height: 1080,
  width: 1920,
};
const mpng = {
  codec_name: "tbd",
  codec_type: "video",
  height: 1080,
  width: 1920,
};

describe("applyProbe", () => {
  it("replaces a video's estimates with the container's numbers", () => {
    const out: ProbeOutput = {
      format: {
        duration: "16.366667",
        tags: { creation_time: "2097-07-20T20:15:05.000000Z" },
      },
      streams: [{ ...mjpeg, avg_frame_rate: "30/1", nb_frames: "491" }, pcm],
    };
    expect(applyProbe(video!, out)).toMatchObject({
      capturedAt: "2097-07-20T20:15:05.000Z",
      durationSec: 16.367,
      fps: 30,
      frameCount: 491,
      hasAudio: true,
      height: 1080,
      metaSource: "ffprobe",
      videoCodec: "mjpeg",
      width: 1920,
    });
  });

  it("derives the frame count when the container does not store one", () => {
    const out: ProbeOutput = {
      format: { duration: "2.002" },
      streams: [{ ...mjpeg, avg_frame_rate: "30000/1001" }],
    };
    expect(applyProbe(video!, out)).toMatchObject({
      fps: 29.97,
      frameCount: 60,
      hasAudio: false,
    });
  });

  it("fills in audio and image details", () => {
    expect(
      applyProbe(audio!, { format: { duration: "72.15675" }, streams: [pcm] }),
    ).toMatchObject({
      audioCodec: "pcm_s16le",
      channels: 1,
      durationSec: 72.157,
      metaSource: "ffprobe",
      sampleRate: 16_000,
    });
    expect(
      applyProbe(jpgImage!, { format: {}, streams: [mjpeg] }),
    ).toMatchObject({
      frameCount: 1,
      height: 1080,
      metaSource: "ffprobe",
      width: 1920,
    });
    expect(
      applyProbe(pngImage!, { format: {}, streams: [mpng] }),
    ).toMatchObject({
      frameCount: 1,
      height: 1080,
      metaSource: "ffprobe",
      width: 1920,
    });
  });

  it("throws when the probe found nothing usable", () => {
    expect(() =>
      applyProbe(jpgImage!, { format: { duration: "0.04" } }),
    ).toThrow(/no image stream/);
    expect(() =>
      applyProbe(jpgImage!, { streams: [{ ...mjpeg, height: 0, width: 0 }] }),
    ).toThrow(/no image stream/);
    expect(() => applyProbe(video!, { format: {}, streams: [mjpeg] })).toThrow(
      /no duration/,
    );
    expect(() =>
      applyProbe(video!, {
        format: { duration: "1" },
        streams: [{ ...mjpeg, avg_frame_rate: "0/0" }],
      }),
    ).toThrow(/no video stream/);
  });
});
