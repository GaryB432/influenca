<script lang="ts">
  import { segmentToCue } from "$lib";
  import type { Manifest, TranscriptionSegment } from "@influenca/core";
  import { onMount } from "svelte";

  let trackElement = $state<HTMLTrackElement | null>(null);

  const CORPUS = "corpus";

  let manifest: Manifest = $state({});

  let selectedVidWithMP4ExtensionYuk = $state<string>();

  let prollyHasAMP4ExtensionToDealWith = $derived(
    selectedVidWithMP4ExtensionYuk
      ? CORPUS.concat("/").concat(selectedVidWithMP4ExtensionYuk)
      : undefined,
  );
  let trackJson = $derived(
    selectedVidWithMP4ExtensionYuk
      ? CORPUS.concat("/")
          .concat(selectedVidWithMP4ExtensionYuk.slice(0, -4))
          .concat(".track.json")
      : undefined,
  );
  // let maniFetch = $state(fetch(`${CORPUS}/.influenca.json`));

  onMount(() => {
    (async () => {
      const maniFetch = fetch(`${CORPUS}/.influenca.json`);
      const maniResponse = await maniFetch;
      if (!maniResponse.ok) {
        return;
      }
      const maniText = await maniResponse.text();
      manifest = JSON.parse(maniText) as Manifest;
      selectedVidWithMP4ExtensionYuk = Object.keys(manifest).at(0);
    })();
  });
</script>

{#if prollyHasAMP4ExtensionToDealWith}
  <video controls src={`/${prollyHasAMP4ExtensionToDealWith}`} width="600">
    <track
      bind:this={trackElement}
      kind="captions"
      label="Custom Cue Track"
      default
    />
  </video>

  <select
    bind:value={selectedVidWithMP4ExtensionYuk}
    onchange={async () => {
      if (trackJson) {
        if (!trackElement?.track) {
          return;
        }
        const response = await fetch(trackJson);
        const segments = (await response.json()) as TranscriptionSegment[];

        const cues = segments
          .map(segmentToCue)
          .map((c) => new VTTCue(c.startTime, c.endTime, c.text));

        const textTrack = trackElement.track;
        if (textTrack.cues) {
          const cuesa = Array.from(textTrack.cues);
          cuesa.forEach((c) => {
            textTrack.removeCue(c);
          });
        }
        textTrack.mode = "showing";

        cues.forEach((cue) => {
          textTrack.addCue(cue);
        });
      }
    }}
  >
    {#each Object.keys(manifest) as slug (slug)}
      <option value={slug}>{slug} is good</option>
    {/each}
  </select>
{/if}
<h1>controller stuff</h1>
<!-- <p>{JSON.stringify(Object.keys(manifest))}</p> -->
<p>{prollyHasAMP4ExtensionToDealWith}</p>
<p>{selectedVidWithMP4ExtensionYuk}</p>
<p>{trackJson}</p>
