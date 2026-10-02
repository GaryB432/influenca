import type { Manifest } from "..";

type Cadnf = Record<string, string[]>;

export function add(...addends: number[]) {
  return addends.reduce((a, b) => (a += b));
}

export async function findem(mnfst: Manifest): Promise<Cadnf> {
  const candidate_results: Cadnf = {};
  for (const [manifestKey, og_video] of Object.entries(mnfst)) {
    const fragmentCandidates: string[] = [];
    const [first_video_key, ...rest] = Object.keys(og_video.video);

    if (!first_video_key || rest.length !== 0) {
      throw new Error("one video only for now");
    }

    const { stats: only_vid_stats } = og_video.video[first_video_key]!;

    const likely_a_fragment =
      only_vid_stats.frames < 1810 &&
      only_vid_stats.frames > 1795 &&
      only_vid_stats.duration_seconds < 61 &&
      only_vid_stats.duration_seconds > 55;

    if (likely_a_fragment) {
      candidate_results[manifestKey] = fragmentCandidates;
    }
  }
  return candidate_results;
}

export function greet(greetee: string): string {
  return `stitcher says hello to ${greetee}`;
}
