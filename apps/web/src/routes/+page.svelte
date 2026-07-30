<script lang="ts">
  import { resolve } from "$app/paths";
  import { segmentToCue } from "$lib";
  import { error } from "@sveltejs/kit";
  import { onMount } from "svelte";
  import type { TranscriptionResponse } from "../app";
  import type { TranscriptionSegment } from "@influenca/core";

  let trackElement = $state<HTMLTrackElement | null>(null);

  let { data } = $props();

  let selectedSlug = $state<string>();

  let selectedVideoSrc = $derived(`cloud/videos/${selectedSlug}`);
  let selectedTrack = $derived(`cloud/transcripts/${selectedSlug}`);

  let segments: TranscriptionSegment[] = $state([]);
  let cues: VTTCue[] = $derived(
    segments
      .map(segmentToCue)
      .map((c) => new VTTCue(c.startTime, c.endTime, c.text)),
  );

  async function slugSelected() {
    if (selectedTrack) {
      const track_response = await fetch(selectedTrack);

      if (!track_response.ok) {
        error(501, "no tracks");
      }

      const response = (await track_response.json()) as TranscriptionResponse;

      segments = response.vtt;

      if (trackElement) {
        const textTrack = trackElement.track;
        clearCues(textTrack);
        textTrack.mode = "showing";
        cues.forEach((cue) => {
          textTrack.addCue(cue);
        });
      }
    }
  }

  onMount(() => {
    selectedSlug = Object.keys(data.manifest).at(0);
    setTimeout(() => {
      slugSelected();
    }, 0);
  });

  function clearCues(textTrack: TextTrack) {
    if (textTrack.cues) {
      const cuesa = Array.from(textTrack.cues);
      cuesa.forEach((c) => {
        textTrack.removeCue(c);
      });
    }
  }
</script>

{#if selectedSlug}
  <video
    controls
    src={selectedVideoSrc}
    width="400"
    ontimeupdate={(e) => {
      if (e.target instanceof HTMLVideoElement) {
        console.log(e.target.currentTime);
      }
    }}
  >
    <track
      bind:this={trackElement}
      kind="captions"
      label="Custom Cue Track"
      default
    />
  </video>

  <select bind:value={selectedSlug} onchange={slugSelected}>
    {#each Object.keys(data.manifest) as slug (slug)}
      <option value={slug}>{slug}</option>
    {/each}
  </select>

  <ul>
    {#each segments as segment}
      <li>{segment.text}</li>
    {/each}
  </ul>
{:else}
  <p>Video content is unavailable atm</p>
{/if}

<p>
  {selectedVideoSrc}
</p>
{#if selectedSlug}
  <p>
    {selectedSlug}
  </p>
  <p>
    <a
      target="_blank"
      href={resolve("/cloud/transcripts/[slug]", { slug: selectedSlug })}
      >selected track</a
    >
  </p>
{/if}
