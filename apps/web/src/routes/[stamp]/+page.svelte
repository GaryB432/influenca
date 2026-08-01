<script lang="ts">
  import { resolve } from "$app/paths";
  import { segmentToCue } from "$lib";
  import { ArrayStepper } from "$lib/array-stepper";
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
    slugJum.select(selectedSlug);
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

  let slugJum = $derived(new ArrayStepper(Object.keys(data.manifest), 0));
</script>

{#snippet nextButton()}
  <svg
    viewBox="0 0 36 36"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    aria-hidden="true"
    role="img"
    preserveAspectRatio="xMidYMid meet"
  >
    <path
      d="M36 32a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v28z"
    >
    </path>
    <path fill="#FFF" d="M27 18L15 7v9.166L5 7v22l10-9.167V29zm0-11h4v22h-4z">
    </path>
  </svg>
{/snippet}

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

    <div class="controls">
      <button
        aria-label="prev"
        onclick={() => {
          const m = slugJum.go(-1);
          selectedSlug = m;
        }}
      >
        {@render nextButton()}
      </button>
      <select
        name="select-slug"
        bind:value={selectedSlug}
        onchange={slugSelected}
      >
        {#each Object.keys(data.manifest) as slug (slug)}
          <option value={slug}>{slug}</option>
        {/each}
      </select>
      <button
        aria-label="next"
        onclick={() => {
          const m = slugJum.go(1);
          selectedSlug = m;
        }}
      >
        {@render nextButton()}
      </button>
    </div>

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
  ul {
    list-style: none;
  }
  li {
    padding: 2px;
    font-weight: 200;
  }
  li.active {
    font-weight: 600;
  }

  video {
    width: 60dvw;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .controls button {
    all: initial;
    display: flex;
    svg {
      fill: var(--ablue);
      height: 2rem;
      width: 2rem;
    }
  }

  button[aria-label="prev"] {
    transform: scaleX(-1);
  }
</style>
