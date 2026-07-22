<script lang="ts">
  import { segmentToCue } from "$lib";
  import type { TranscriptionSegment } from "@influenca/core";
  import { onMount } from "svelte";

  // let videoElement = $state<HTMLVideoElement | null>(null);
  let trackElement = $state<HTMLTrackElement | null>(null);

  let vvf = $state("VID00050");
  let cc = $derived(`corpus/${vvf}`);

  onMount(() => {
    (async () => {
      // 1. Fetch JSON from the static folder
      const response = await fetch(`/${cc}.track.json`);
      const raw = (await response.json()) as TranscriptionSegment[];

      const data = raw.map(segmentToCue);

      console.log(data);

      // 2. Ensure track sheet is ready (browser requirement)
      if (!trackElement || !trackElement.track) return;
      const textTrack = trackElement.track;
      textTrack.mode = "showing"; // Make cues active and visible

      // 3. Map JSON objects to native VTTCues and add them
      data.forEach(
        (item: {
          startTime: number;
          endTime: number;
          text: string;
          id?: string;
        }) => {
          const cue = new VTTCue(item.startTime, item.endTime, item.text);
          if (item.id) cue.id = item.id;

          textTrack.addCue(cue);
        },
      );
    })();
  });
</script>

<video controls src={`/${cc}.mp4`} width="600">
  <track
    bind:this={trackElement}
    kind="captions"
    label="Custom Cue Track"
    default
  />
</video>
