<script lang="ts">
  import { segmentToCue } from "$lib";
  import type { Manifest, TranscriptionSegment } from "@influenca/core";
  import { onMount } from "svelte";

  let trackElement = $state<HTMLTrackElement | null>(null);

  const CORPUS = "corpus";

  let manifest: Manifest = $state({});

  let selectedSlug = $state<string>();

  let selectedVideoSrc = $derived.by(() => {
    if (selectedSlug) {
      const e = manifest[selectedSlug!];

      if (e.video) {
        const videoKeys = Object.keys(e.video);
        const fvk = videoKeys.at(0);
        if (fvk) {
          return CORPUS.concat("/").concat(fvk);
        }
      }
    }
  });

  let selectedTrack = $derived.by(() => {
    if (selectedSlug) {
      const e = manifest[selectedSlug];

      if (e.transcript) {
        return CORPUS.concat("/").concat(e.transcript?.segments);
      }
    }
  });

  async function slugSelected() {
    if (selectedTrack && trackElement) {
      // if (!trackElement) {
      //   throw new Error("o please");
      // }
      const response = await fetch(selectedTrack);

      if (!response.ok) {
        throw new Error("no tracks");
      }
      const segments = (await response.json()) as TranscriptionSegment[];

      const cues = segments
        .map(segmentToCue)
        .map((c) => new VTTCue(c.startTime, c.endTime, c.text));

      const textTrack = trackElement.track;
      clearCues(textTrack);
      textTrack.mode = "showing";

      cues.forEach((cue) => {
        textTrack.addCue(cue);
      });
    }
  }

  onMount(() => {
    (async () => {
      const maniFetch = fetch(`${CORPUS}/.influenca.json`);
      const maniResponse = await maniFetch;
      if (!maniResponse.ok) {
        return;
      }
      const maniText = await maniResponse.text();
      manifest = JSON.parse(maniText) as Manifest;

      selectedSlug = Object.keys(manifest).at(0);
      setTimeout(() => {
        slugSelected();
      }, 0);
    })();
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
  <video controls src={`/${selectedVideoSrc}`} width="400">
    <track
      bind:this={trackElement}
      kind="captions"
      label="Custom Cue Track"
      default
    />
  </video>

  <select bind:value={selectedSlug} onchange={slugSelected}>
    {#each Object.keys(manifest) as slug (slug)}
      <option value={slug}>{slug} is good</option>
    {/each}
  </select>
{/if}

<p>If you have stuff it will be just above</p>
