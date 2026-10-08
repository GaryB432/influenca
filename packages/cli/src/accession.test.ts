import { type Manifest, MANIFEST_FILENAME } from "@influenca/core";
import { readJSON } from "@influenca/core/node";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { runAccession } from "./accession.js";
import { runAnalyze } from "./analyze.js";

describe("accession + analyze", () => {
  let fixtures: string;
  let root: string;
  let inDir: string;
  let outDir: string;
  const base = { dryRun: false, noTimestamp: true, verbose: false };

  // Real media, made once: one second of 30 fps video with sound, and a second of audio.
  beforeAll(async () => {
    fixtures = await mkdtemp(join(tmpdir(), "influenca-fixtures-"));
    const ffmpeg = (...args: string[]) =>
      execFileSync("ffmpeg", ["-v", "error", ...args]);
    const tone = ["-f", "lavfi", "-i", "sine=duration=1:sample_rate=16000"];
    ffmpeg(
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:rate=30:size=160x120",
      ...tone,
      "-c:v",
      "mjpeg",
      "-c:a",
      "pcm_s16le",
      join(fixtures, "a.avi"),
    );
    ffmpeg(...tone, join(fixtures, "c.wav"));
  });
  afterAll(() => rm(fixtures, { force: true, recursive: true }));

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "influenca-"));
    inDir = join(root, "intake");
    outDir = join(root, "out");
    await mkdir(inDir);
    await copyFile(join(fixtures, "a.avi"), join(inDir, "a.avi"));
    await writeFile(join(inDir, "b.JPG"), "x");
    await copyFile(join(fixtures, "c.wav"), join(inDir, "c.wav"));
    await writeFile(join(inDir, "notes.txt"), "ignored");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {}); // b.JPG is not a real picture
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(root, { force: true, recursive: true });
  });

  it("converts avi and wav, copies the rest, and writes a manifest of what it kept", async () => {
    await runAccession({ ...base, inDir, outDir });
    expect((await readdir(outDir)).toSorted()).toEqual([
      MANIFEST_FILENAME,
      "a.mp4",
      "b.JPG",
      "c.mp3",
    ]);
    const m = await readJSON<Manifest>(join(outDir, MANIFEST_FILENAME));
    expect(m.entries).toMatchObject([
      {
        frameCount: 30,
        hasAudio: true,
        kind: "video",
        sourceName: "a.avi",
        videoCodec: "h264",
      },
      { kind: "image", metaSource: "estimated", outputName: "b.JPG" },
      {
        audioCodec: "mp3",
        kind: "audio",
        outputName: "c.mp3",
        sourceName: "c.wav",
      },
    ]);
  });

  it("stops without a manifest when a file cannot be converted", async () => {
    await writeFile(join(inDir, "d.avi"), "not a video");
    await expect(runAccession({ ...base, inDir, outDir })).rejects.toThrow(
      /ffmpeg failed on d\.avi/,
    );
    // What was finished stays, complete; nothing of d is left behind, and there is no manifest.
    expect((await readdir(outDir)).toSorted()).toEqual([
      "a.mp4",
      "b.JPG",
      "c.mp3",
    ]);
  });

  it("writes nothing on --dry-run", async () => {
    await runAccession({ ...base, dryRun: true, inDir, outDir });
    await expect(readdir(outDir)).rejects.toThrow();
  });

  it("puts a timestamped run in a subfolder", async () => {
    await runAccession({ ...base, inDir, noTimestamp: false, outDir });
    const [run] = await readdir(outDir);
    expect(run).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
  });

  it("refuses to overwrite an existing run", async () => {
    await runAccession({ ...base, inDir, outDir });
    await expect(runAccession({ ...base, inDir, outDir })).rejects.toThrow(
      /Refusing to overwrite/,
    );
  });

  it("refuses to convert over a file left by a partial run", async () => {
    await mkdir(outDir);
    await writeFile(join(outDir, "a.mp4"), "partial");
    await expect(runAccession({ ...base, inDir, outDir })).rejects.toThrow(
      /Refusing to overwrite/,
    );
    expect(await readdir(outDir)).not.toContain(MANIFEST_FILENAME);
  });

  it("analyze prints the frame total", async () => {
    await runAccession({ ...base, inDir, outDir });
    await runAnalyze({ inDir: outDir, language: "english", minimal: true });
    expect(console.log).toHaveBeenCalledWith("Total frames: 31");
  });

  describe("with a run from an older influenca alongside", () => {
    let legacy: string;
    beforeEach(async () => {
      legacy = join(outDir, "20260802T160237Z"); // sorts after today's 2059-05-20T… stamps
      await mkdir(legacy, { recursive: true });
      await writeFile(
        join(legacy, MANIFEST_FILENAME),
        JSON.stringify({ VID00000: {} }),
      );
    });

    it("analyze without a folder picks the latest readable run", async () => {
      await runAccession({ ...base, inDir, noTimestamp: false, outDir });
      vi.stubEnv("INFLUENCA_MEDIA_DIR", outDir);
      await runAnalyze({ language: "english", minimal: true });
      expect(console.log).toHaveBeenCalledWith("Total frames: 31");
    });

    it("analyze names the problem when pointed at it", async () => {
      await expect(
        runAnalyze({ inDir: legacy, language: "english", minimal: true }),
      ).rejects.toThrow(/not a version 1 manifest/);
    });
  });
});
