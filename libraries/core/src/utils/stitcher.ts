import type { Manifest, VideoStatisticalBlock } from "..";

type StitchCandidate = Record<string, { name: string } & VideoStatisticalBlock>;

const isEmptyObject = (x: unknown) =>
  x !== null && typeof x === "object" && Object.keys(x).length === 0;

export async function checkForFragments(manifest: Manifest): Promise<Manifest> {
  const fresh_copy = { ...manifest };
  const frags = await locate_candidates_low_level(fresh_copy);
  if (!isEmptyObject(frags)) {
    console.warn("videos are being ignored here");
  }
  return fresh_copy;
}

export function isNear(a: number, b: number, range = 0) {
  return Math.abs(a - b) <= range;
}

export async function locate_candidates_low_level(
  manifest: Manifest,
): Promise<StitchCandidate> {
  const candidates: StitchCandidate = {};
  for (const [manifestKey, v_entry] of Object.entries(manifest)) {
    const [first_video_key, ...rest] = Object.keys(v_entry.video);

    if (!first_video_key || rest.length !== 0) {
      throw new Error("one video only for now");
    }

    const { stats } = v_entry.video[first_video_key]!;

    const likely_a_fragment =
      isNear(stats.frames, 1800, 5) && isNear(stats.duration_seconds, 60, 3);

    if (likely_a_fragment) {
      candidates[manifestKey] = {
        ...stats,
        name: first_video_key,
      };
    }
  }
  return candidates;
}
