import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";

import {
  AscessionCommand,
  formatProgressMeter,
} from "./ascession-command.ts";

class FakeProgressProcess extends EventEmitter {
  public readonly stderr = new EventEmitter();
}

test("formats the progress meter with a 1-based current file index", () => {
  assert.equal(formatProgressMeter(0, 3), "[1/3]");
  assert.equal(formatProgressMeter(2, 3), "[3/3]");
});

test("logs a 1-based progress meter before each AVI is processed", async () => {
  process.env.HOME = "/tmp/home";

  const logLines: string[] = [];
  const spawnCalls: string[][] = [];

  const command = new AscessionCommand({
    analyzeMotion: async () => ({ frames: [] }),
    error: (...data) => {
      throw new Error(data.join(" "));
    },
    log: (...data) => {
      logLines.push(data.join(" "));
    },
    mkdirSync: () => undefined,
    readdirSync: () => ["FIRST.AVI", "notes.txt", "second.avi"],
    spawn: (_command, args) => {
      spawnCalls.push(args);
      const process = new FakeProgressProcess();
      queueMicrotask(() => {
        process.stderr.emit(
          "data",
          "frame=   42 fps=24.9 bitrate=123.4kbits/s",
        );
        process.emit("close", 0);
      });
      return process;
    },
    writeFileSync: () => undefined,
  });

  const result = await command.execute({
    args: ["~/videos"],
    options: {
      output: "/tmp/out",
    },
  });

  assert.match(result, /^Processed 2 files\. Manifest saved to \/tmp\/out\/videos-/);
  assert.deepEqual(
    logLines.filter((line) => line.includes("Converting")),
    [
      "[1/2] Converting FIRST.AVI -> first.mp4...",
      "[2/2] Converting second.avi -> second.mp4...",
    ],
  );
  assert.ok(logLines.every((line) => !line.includes("[0/2]")));
  assert.deepEqual(spawnCalls[0].slice(0, 2), ["-i", "/tmp/home/videos/FIRST.AVI"]);
  assert.deepEqual(spawnCalls[1].slice(0, 2), ["-i", "/tmp/home/videos/second.avi"]);
});
