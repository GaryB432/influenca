import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

/** How far one file's worker has got, 0..1. Copy reports bytes; ffmpeg reports time. */
export type OnProgress = (fraction: number) => void;

/** Runs ffmpeg to completion, reporting position over durationSec. Resolves with its log. */
export async function runFfmpeg(
  args: string[],
  durationSec: number,
  onProgress: OnProgress,
): Promise<string> {
  const child = spawn(
    "ffmpeg",
    ["-nostdin", "-nostats", "-progress", "pipe:1", ...args],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  // Our own exit (Ctrl+C included) must not leave ffmpeg running in the background.
  const kill = () => child.kill();
  process.once("exit", kill);

  let log = "";
  child.stderr.on("data", (chunk: Buffer) => (log += chunk.toString()));
  createInterface({ input: child.stdout }).on("line", (line) => {
    const match = /^out_time_us=(\d+)/.exec(line);
    if (match && durationSec > 0)
      onProgress(Number(match[1]) / 1e6 / durationSec);
  });

  try {
    const [code] = (await once(child, "close")) as [null | number];
    if (code !== 0)
      throw new Error(log.trim().split("\n").at(-1) || `exit code ${code}`);
    return log;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "ffmpeg not found; it is needed to convert and analyze media.",
        { cause: error },
      );
    }
    throw error;
  } finally {
    process.off("exit", kill);
  }
}
