<script lang="ts">
  import { segmentToCue } from "$lib";
  import type { Manifest, TranscriptionSegment } from "@influenca/core";
  // import { videoSrcPath } from "@influenca/core";
  import { onMount } from "svelte";

  let trackElement = $state<HTMLTrackElement | null>(null);

  const CORPUS = "corpus";

  let manifest: Manifest = $state({});

  // let asdf = $derived(
  //   Object.keys(manifest).map((k) => {
  //     return k;
  //   }),
  // );

  // let selectedVidWithMP4ExtensionYuk = $state<string>();
  let selectedSlug = $state<string>();

  let fff = $derived.by(() => {
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
    return undefined;
  });

  let ffg = $derived.by(() => {
    if (selectedSlug) {
      const e = manifest[selectedSlug];

      if (!e) throw new Error("wtf");

      if (e.transcript) {
        const f = CORPUS.concat("/").concat(e.transcript.segments);
        console.log(f);
        // apps/web/static/corpus/PXL_20260717_150719138.vtt.json
        //                 corpus/PXL_20260717_150719138.vtt.json
        return f;
        // const txks = Object.keys(e.transcript);
        // const fvk = txks!;
        // if (fvk) {
        //   return CORPUS.concat("/").concat(fvk);
        // }
      }
    }
    return undefined;
  });

  // let prollyHasAMP4ExtensionToDealWith = $derived(
  //   selectedVidWithMP4ExtensionYuk
  //     ? CORPUS.concat("/").concat(selectedVidWithMP4ExtensionYuk)
  //     : undefined,
  // );

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
      // selectedVidWithMP4ExtensionYuk = Object.keys(manifest).at(0);
      selectedSlug = Object.keys(manifest).at(0);
    })();
  });
</script>

{#if selectedSlug}
  <video controls src={`/${fff}`} width="400">
    <track
      bind:this={trackElement}
      kind="captions"
      label="Custom Cue Track"
      default
    />
  </video>

  <select
    bind:value={selectedSlug}
    onchange={async () => {
      if (ffg) {
        if (!trackElement) {
          throw new Error("o please");
        }
        // if (!trackElement?.track) {
        //   return;
        // }
        const response = await fetch(ffg);

        if (!response.ok) {
          throw new Error("nope");
        }
        const segments = (await response.json()) as TranscriptionSegment[];

        console.log(segments);

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
<p>{ffg}</p>
<p>{fff}</p>
<h1>more</h1>
