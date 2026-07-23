import type { TranscriptionSegment } from "@influenca/core";

type PetitVTTCue = {
  id?: string;
} & Pick<VTTCue, "endTime" | "startTime" | "text">;

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
