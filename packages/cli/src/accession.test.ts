import {
  type Analysis,
  ANALYSIS_FILENAME,
  type Manifest,
  MANIFEST_FILENAME,
  type Transcripts,
  TRANSCRIPTS_FILENAME,
} from "@influenca/core";
import { readJSON, updateEntry } from "@influenca/core/node";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
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
import { runTranscribe } from "./transcribe.js";

describe("accession + analyze", () => {
  let fixtures: string;
  let root: string;
  let inDir: string;
  let outDir: string;
  const base = {
    dryRun: false,
    timestamp: false,
    transcribe: false,
    verbose: false,
  };

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
    vi.stubEnv("OPENAI_API_KEY", ""); // whatever the shell has, nothing here reaches OpenAI
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("rewraps mov as mp4 without encoding it again", async () => {
    // MPEG-4 video is not what a conversion would produce, so finding it kept shows nothing was re-encoded.
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      join(fixtures, "a.avi"),
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      join(inDir, "d.MOV"),
    ]);
    await runAccession({ ...base, inDir, outDir });
    expect(await readdir(outDir)).toContain("d.mp4");
    const m = await readJSON<Manifest>(join(outDir, MANIFEST_FILENAME));
    expect(m.entries.find((e) => e.sourceName === "d.MOV")).toMatchObject({
      frameCount: 30,
      hasAudio: true,
      metaSource: "ffprobe",
      outputName: "d.mp4",
      videoCodec: "mpeg4",
    });
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
    await runAccession({ ...base, inDir, outDir, timestamp: true });
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
    expect(process.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Total frames: 31"),
    );
  });

  it("analyze writes its measurements beside the manifest and reuses them", async () => {
    await runAccession({ ...base, inDir, outDir });
    const before = await readJSON<Manifest>(join(outDir, MANIFEST_FILENAME));
    const read = () => readJSON<Analysis>(join(outDir, ANALYSIS_FILENAME));

    await runAnalyze({ inDir: outDir, language: "english", minimal: false });
    const first = await read();
    expect(first.entries).toEqual({
      1: { silentSec: 0, stillSec: 0 },
      3: { silentSec: 0 },
    });
    expect(await readJSON<Manifest>(join(outDir, MANIFEST_FILENAME))).toEqual(
      before,
    );

    await runAnalyze({ inDir: outDir, language: "english", minimal: false });
    expect((await read()).createdAt).toBe(first.createdAt);

    await runAnalyze({
      inDir: outDir,
      language: "english",
      minimal: false,
      redo: true,
    });
    expect((await read()).createdAt).not.toBe(first.createdAt);
  });

  describe("transcribe", () => {
    const heard = {
      language: "english",
      segments: [{ end: 1.5, start: 0, text: " Hello there." }],
      text: "Hello there.",
    };
    const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello there.\n";
    const read = () =>
      readJSON<Transcripts>(join(outDir, TRANSCRIPTS_FILENAME));
    const reply = (body: unknown, status = 200) =>
      whisper.mockImplementation(() =>
        Promise.resolve(Response.json(body, { status })),
      );
    let whisper: ReturnType<typeof vi.fn<typeof fetch>>;

    beforeEach(async () => {
      vi.stubEnv("OPENAI_API_KEY", "sk-test");
      whisper = vi.fn<typeof fetch>();
      reply(heard);
      vi.stubGlobal("fetch", whisper);
      await runAccession({ ...base, inDir, outDir });
    });

    it("accession transcribes what it keeps unless told not to", async () => {
      const fresh = join(root, "fresh");
      await runAccession({
        ...base,
        inDir,
        outDir: fresh,
        transcribe: true,
      });
      expect((await readdir(fresh)).toSorted()).toEqual([
        MANIFEST_FILENAME,
        TRANSCRIPTS_FILENAME,
        "a.mp4",
        "a.vtt",
        "b.JPG",
        "c.mp3",
        "c.vtt",
      ]);
    });

    it("accession still keeps everything when Whisper cannot be reached", async () => {
      whisper.mockRejectedValue(new Error("fetch failed"));
      const fresh = join(root, "fresh");
      await runAccession({
        ...base,
        inDir,
        outDir: fresh,
        transcribe: true,
      });
      expect((await readdir(fresh)).toSorted()).toEqual([
        MANIFEST_FILENAME,
        "a.mp4",
        "b.JPG",
        "c.mp3",
      ]);
      expect(process.stderr.write).toHaveBeenCalledWith(
        expect.stringContaining("Kept, but not all transcribed: fetch failed"),
      );
    });

    it("writes a transcript beside each file with sound, once", async () => {
      await runTranscribe({ inDir: outDir });
      expect(await readFile(join(outDir, "a.vtt"), "utf8")).toBe(VTT);
      expect(await readFile(join(outDir, "c.vtt"), "utf8")).toBe(VTT);
      const done = {
        language: "english",
        model: "whisper-1",
        status: "done",
        words: 2,
      };
      expect((await read()).entries).toEqual({
        1: { ...done, vttName: "a.vtt" },
        3: { ...done, vttName: "c.vtt" },
      });

      const [, request] = whisper.mock.calls[0] ?? [];
      expect(request?.headers).toEqual({ Authorization: "Bearer sk-test" });
      const form = request?.body as FormData;
      expect(form.get("response_format")).toBe("verbose_json");
      expect((form.get("file") as File).size).toBeGreaterThan(0);

      await runTranscribe({ inDir: outDir });
      expect(whisper).toHaveBeenCalledTimes(2);
      await runTranscribe({ inDir: outDir, redo: true });
      expect(whisper).toHaveBeenCalledTimes(4);
    });

    it("does not send a file with nothing to hear", async () => {
      execFileSync("ffmpeg", [
        ..."-v error -f lavfi -i anullsrc=r=16000:cl=mono -t 2".split(" "),
        join(outDir, "c.mp3"),
        "-y",
      ]);
      await runTranscribe({ inDir: outDir });
      expect(whisper).toHaveBeenCalledTimes(1);
      expect((await read()).entries[3]).toEqual({ status: "silent" });
    });

    it("records a file Whisper turns down and does not send it again", async () => {
      reply({ error: { message: "too long" } }, 400);
      await runTranscribe({ inDir: outDir });
      expect((await read()).entries[3]).toEqual({
        model: "whisper-1",
        reason: "too long (HTTP 400)",
        status: "failed",
      });
      expect(await readdir(outDir)).not.toContain("c.vtt");

      await runTranscribe({ inDir: outDir });
      expect(whisper).toHaveBeenCalledTimes(2);
    });

    it("stops on a refused key and carries on from there next time", async () => {
      whisper.mockImplementationOnce(() =>
        Promise.resolve(Response.json(heard)),
      );
      whisper.mockImplementationOnce(() =>
        Promise.resolve(
          Response.json({ error: { message: "bad key" } }, { status: 401 }),
        ),
      );
      await expect(runTranscribe({ inDir: outDir })).rejects.toThrow(
        "Whisper: bad key (HTTP 401)",
      );
      expect(Object.keys((await read()).entries)).toEqual(["1"]);

      await runTranscribe({ inDir: outDir });
      expect(whisper).toHaveBeenCalledTimes(3);
      expect(Object.keys((await read()).entries)).toEqual(["1", "3"]);
    });

    it("needs a key only when there is something to send", async () => {
      vi.stubEnv("OPENAI_API_KEY", "");
      await expect(runTranscribe({ inDir: outDir })).rejects.toThrow(
        /OPENAI_API_KEY/,
      );
    });

    it("transcribe shows the names given on the web page, beside the filenames", async () => {
      await updateEntry(outDir, "3", { name: "toast" });
      await runTranscribe({ inDir: outDir });
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/^ {2}1 {2} {5} {2}a\.mp4 {2}video/),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/^ {2}3 {2}toast {2}c\.mp3 {2}audio/),
      );
    });

    it("analyze shows the names given on the web page, beside the filenames", async () => {
      await runAnalyze({ inDir: outDir, language: "english", minimal: false });
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/^ {2}1 {2}a\.mp4 {2}video/),
      );

      await updateEntry(outDir, "1", { name: "pool-b-roll" });
      await runAnalyze({ inDir: outDir, language: "english", minimal: false });
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/^ {2}1 {2}pool-b-roll {2}a\.mp4 {2}video/),
      );
      // A file with no name keeps its place in the columns.
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/^ {2}3 {2} {11} {2}c\.mp3 {2}audio/),
      );
    });

    it("analyze counts the words, and names a language you did not expect", async () => {
      await runTranscribe({ inDir: outDir });
      await runAnalyze({ inDir: outDir, language: "french", minimal: false });
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringMatching(/c\.mp3 .* 2 words \(english\)\n$/),
      );
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Total words: 4"),
      );
    });
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
      await runAccession({ ...base, inDir, outDir, timestamp: true });
      vi.stubEnv("INFLUENCA_MEDIA_DIR", outDir);
      await runAnalyze({ language: "english", minimal: true });
      expect(process.stdout.write).toHaveBeenCalledWith(
        expect.stringContaining("Total frames: 31"),
      );
    });

    it("analyze names the problem when pointed at it", async () => {
      await expect(
        runAnalyze({ inDir: legacy, language: "english", minimal: true }),
      ).rejects.toThrow(/not a version 1 manifest/);
    });
  });
});
