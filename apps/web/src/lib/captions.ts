import type { TranscriptionSegment } from "@influenca/core";

type PetitVTTCue = Pick<VTTCue, "endTime" | "startTime" | "text"> & {
  id?: string;
};

export function segmentToCue(
  segment: Pick<TranscriptionSegment, "end" | "id" | "start" | "text">,
): PetitVTTCue {
  return {
    endTime: segment.end,
    id: String(segment.id),
    startTime: segment.start,
    text: segment.text,
  };
}
