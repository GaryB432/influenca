<script lang="ts">
  import { onMount } from "svelte";

  let videoElement = $state<HTMLVideoElement | null>(null);
  let trackElement = $state<HTMLTrackElement | null>(null);

  onMount(() => {
    (async () => {
      // 1. Fetch JSON from the static folder
      const response = await fetch("/captions.json");
      const data = await response.json();

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

<video bind:this={videoElement} controls src="/apps/web/static/corpus/VID00000.mp4" width="600">
  <!-- Kind metadata hides default rendering if you want to render text yourself -->
  <track
    bind:this={trackElement}
    kind="metadata"
    label="Custom Cue Track"
    default
  />
</video>
