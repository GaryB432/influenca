import type { Manifest, VideoStatisticalBlock } from "..";

type StitchCandidate = Record<string, VideoStatisticalBlock>;

export async function locate_candidates_low_level(
  mnfst: Manifest,
): Promise<StitchCandidate> {
  const candidate_results: StitchCandidate = {};
  for (const [manifestKey, og_video] of Object.entries(mnfst)) {
    // const fragmentCandidates: string[] = [];
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
      candidate_results[manifestKey] = only_vid_stats;
    }
  }
  return candidate_results;
}
