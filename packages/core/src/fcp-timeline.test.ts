import { describe, expect, it } from "vitest";

import type { Manifest } from "./manifest.js";

import { FcpTimeline, type FcpxmlDocument } from "./fcp-timeline.js";

const specimens: { manifest: Manifest; fcp: FcpxmlDocument } = {
  fcp: {
    fcpxml: {
      ":@": {
        version: "1.10",
      },
      resources: {
        asset: [
          {
            ":@": {
              duration: "0s",
              hasAudio: "0",
              hasVideo: "0",
              id: "4",
              name: "pic 4",
              src: "file:///m/pic-4.jpg",
              start: "0s",
            },
          },
        ],
      },
    },
  },
  manifest: {
    createdAt: "2059-05-20T22:50:22.788Z",
    entries: [
      {
        bytes: 21350063,
        capturedAt: "2059-05-20T21:07:28.000Z",
        deleted: true,
        durationSec: 21.502,
        fps: 29.998,
        frameCount: 645,
        hasAudio: true,
        height: 1080,
        id: "1",
        kind: "video",
        metaSource: "ffprobe",
        outputName: "IMG_0017.mp4",
        sourceName: "IMG_0017.MOV",
        transcript: {
          language: "english",
          model: "whisper-1",
          status: "done",
          vttName: "IMG_0017.vtt",
          words: 53,
        },
        videoCodec: "hevc",
        width: 1920,
      },
      {
        bytes: 44911509,
        capturedAt: "2059-05-20T21:08:05.000Z",
        durationSec: 45.969,
        fps: 29.999,
        frameCount: 1379,
        hasAudio: true,
        height: 1080,
        id: "2",
        kind: "video",
        metaSource: "ffprobe",
        outputName: "IMG_0018.mp4",
        sourceName: "IMG_0018.MOV",
        title: "nikon overview",
        transcript: {
          language: "english",
          model: "whisper-1",
          status: "done",
          vttName: "IMG_0018.vtt",
          words: 78,
        },
        videoCodec: "hevc",
        width: 1920,
      },
      {
        bytes: 2277231,
        frameCount: 1,
        height: 4032,
        id: "3",
        kind: "image",
        metaSource: "ffprobe",
        outputName: "IMG_0019.jpg",
        sourceName: "IMG_0019.HEIC",
        width: 3024,
      },
      {
        bytes: 2232537,
        frameCount: 1,
        height: 4032,
        id: "4",
        kind: "image",
        metaSource: "ffprobe",
        outputName: "IMG_0020.jpg",
        sourceName: "IMG_0020.HEIC",
        title: "still osmo pocket 3 shot",
        width: 3024,
      },
      {
        bytes: 2105297,
        frameCount: 1,
        height: 4032,
        id: "5",
        kind: "image",
        metaSource: "ffprobe",
        outputName: "IMG_0021.jpg",
        sourceName: "IMG_0021.HEIC",
        title: "another osmo",
        width: 3024,
      },
    ],
    version: 1,
  },
};

describe("fcp-timeline", () => {
  const sut = new FcpTimeline();

  it("makes fcp of specimen", async () => {
    const { manifest } = specimens;

    // for (const e of manifest.entries) {

    // }

    const adds = manifest.entries.map((e) => {
      return sut.add(
        e,
        `stem_${e.id}_${e.kind}`,
        `target_${e.id}_${e.kind}`,
        `media_name_${e.id}_${e.kind}.ext`,
      );
    });

    void (await Promise.all(adds));

    expect(sut.xml()).toMatchInlineSnapshot(`
      "<fcpxml version="1.10">
        <resources>
          <asset id="1" name="stem_1_video" src="file://media_name_1_video.ext" start="0s" duration="21.502s" hasAudio="1" hasVideo="1"/>
          <asset id="2" name="nikon overview" src="file://media_name_2_video.ext" start="0s" duration="45.969s" hasAudio="1" hasVideo="1"/>
          <asset id="3" name="stem_3_image" src="file://media_name_3_image.ext" start="0s" duration="0s" hasAudio="0" hasVideo="0"/>
          <asset id="4" name="still osmo pocket 3 shot" src="file://media_name_4_image.ext" start="0s" duration="0s" hasAudio="0" hasVideo="0"/>
          <asset id="5" name="another osmo" src="file://media_name_5_image.ext" start="0s" duration="0s" hasAudio="0" hasVideo="0"/>
        </resources>
      </fcpxml>
      "
    `);
  });
});
