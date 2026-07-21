<script lang="ts">
  import { onMount } from 'svelte';

  let videoElement: HTMLVideoElement;

  onMount(() => {
    // Add text track and cues once the video element is mounted and available
    const track = videoElement.addTextTrack("captions", "Captions", "en");
    track.mode = "showing";

    track.addCue(new VTTCue(0, 0.9, "Hildy!"));
    track.addCue(new VTTCue(1, 1.4, "How are you?"));
    track.addCue(new VTTCue(1.5, 2.9, "Tell me, is the lord of the universe in?"));
    track.addCue(new VTTCue(3, 4.2, "Yes, he's in - in a bad humor"));
    track.addCue(new VTTCue(4.3, 6, "Somebody must've stolen the crown jewels"));

    console.log(track.cues);
  });
</script>

<div class="container">
  <!-- Bind the video element using bind:this -->
  <video bind:this={videoElement} controls src="/corpus/VID00000.mp4">
    <track kind="captions" />
  </video>
</div>

<style>
  video {
    width: 420px;
    height: 300px;
  }
</style>