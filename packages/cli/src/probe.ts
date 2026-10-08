import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** The slice of `ffprobe -of json` output we ask for. Numbers arrive as strings. */
export type ProbeOutput = {
  format?: { duration?: string; tags?: { creation_time?: string } };
  streams?: ProbeStream[];
};

type ProbeStream = {
  avg_frame_rate?: string;
  channels?: number;
  codec_name?: string;
  codec_type?: string;
  height?: number;
  nb_frames?: string;
  sample_rate?: string;
  width?: number;
};

const SHOW_ENTRIES =
  "format=duration:format_tags=creation_time:" +
  "stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames,channels,sample_rate";

/** Reads container and stream headers only, so it is quick even for large files. */
export async function probe(path: string): Promise<ProbeOutput> {
  const { stdout } = await promisify(execFile)("ffprobe", [
    "-v",
    "error",
    "-of",
    "json",
    "-show_entries",
    SHOW_ENTRIES,
    path,
  ]);
  return JSON.parse(stdout) as ProbeOutput;
}
