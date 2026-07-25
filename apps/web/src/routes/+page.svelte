<script lang="ts">
  import { resolve } from "$app/paths";
  import { segmentToCue } from "$lib";
  import { error } from "@sveltejs/kit";
  import { onMount } from "svelte";
  import type { TranscriptionResponse } from "../app";

  let trackElement = $state<HTMLTrackElement | null>(null);

  let { data } = $props();

  let selectedSlug = $state<string>();

  let selectedVideoSrc = $derived(`cloud/videos/${selectedSlug}`);
  let selectedTrack = $derived(`cloud/transcripts/${selectedSlug}`);

  async function slugSelected() {

    if (selectedTrack) {
      const response = await fetch(selectedTrack);

      if (!response.ok) {
        error(501, "no tracks");
      }

      const deets = (await response.json()) as TranscriptionResponse;

      const cues = deets.vtt
        .map(segmentToCue)
        .map((c) => new VTTCue(c.startTime, c.endTime, c.text));

      cues.forEach((cue) => {
        console.log(cue);
      });

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
  <video controls src={selectedVideoSrc} width="400">
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
