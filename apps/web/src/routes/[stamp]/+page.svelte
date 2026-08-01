<script lang="ts">
  import { resolve } from "$app/paths";
  import { segmentToCue } from "$lib";
  import type { TranscriptionSegment } from "@influenca/core";
  import { error } from "@sveltejs/kit";
  import { onMount } from "svelte";
  import type { TranscriptionResponse } from "../../app";

  type SegmentSource = TranscriptionSegment & { active: boolean };

  let trackElement = $state<HTMLTrackElement | null>(null);

  let { data } = $props();

  let selectedSlug = $state<string>();

  const selectedVideoSrc = $derived(
    [data.stamp, selectedSlug, "video"].join("/"),
  );
  const selectedTrack = $derived(
    [data.stamp, selectedSlug, "transcript"].join("/"),
  );

  let segments: SegmentSource[] = $state([]);
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

      segments = response.vtt.map((s) => ({ ...s, active: false }));

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

  function update() {
    segments.forEach((segment) => {
      const v = trackElement?.parentElement as HTMLVideoElement;
      const currentTime = v.currentTime;
      const bef = segment.end < currentTime;
      const aft = segment.start > currentTime;
      segment.active = !(bef || aft);
    });
  }
</script>

<section class="vp">
  {#if selectedSlug}
    <video controls src={selectedVideoSrc} ontimeupdate={(e) => update()}>
      <track
        bind:this={trackElement}
        kind="captions"
        label="Custom Cue Track"
        default
      />
    </video>

    <select
      name="select-slug"
      bind:value={selectedSlug}
      onchange={slugSelected}
    >
      {#each Object.keys(data.manifest) as slug (slug)}
        <option value={slug}>{slug}</option>
      {/each}
    </select>

    <ul>
      {#each segments as segment (segment.id)}
        <li class:active={segment.active}>{segment.text}</li>
      {/each}
    </ul>
  {:else}
    <p>Video content is unavailable atm</p>
  {/if}
  <a href={resolve("/")}>&#127910; Back</a>
</section>

<style>
  .vp {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  li {
    display: none;
  }
  li.active {
    display: block;
  }

  video {
    width: 60dvw;
  }
</style>
