<script lang="ts">
  import { formatDuration, type ManifestEntry } from "@influenca/core";

  import MediaKindIcon from "#lib/components/MediaKindIcon.svelte";

  interface Props {
    entry: ManifestEntry;
  }
  let { entry }: Props = $props();

  function share(sec: number, of: number) {
    return `${Math.round((sec / of) * 100)}%`;
  }

  let facts = $derived.by(() => {
    const { analysis = {}, transcript } = entry;

    return [
      ...(entry.kind === "image" ? [] : [formatDuration(entry.durationSec)]),
      ...(entry.width && entry.height
        ? [`${entry.width}×${entry.height}`]
        : []),
      ...(entry.kind === "image" || analysis.stillSec === undefined
        ? []
        : [`still ${share(analysis.stillSec, entry.durationSec)}`]),
      ...(entry.kind === "image" || analysis.silentSec === undefined
        ? []
        : [`silent ${share(analysis.silentSec, entry.durationSec)}`]),
      ...(transcript?.status === "done"
        ? [`${transcript.words} words (${transcript.language})`]
        : []),
      ...(transcript?.status === "silent" ? ["nothing to hear"] : []),
      ...(transcript?.status === "failed" ? ["transcript failed"] : []),
      ...(entry.metaSource === "estimated" ? ["estimated"] : []),
    ];
  });
</script>

<article class="facts">
  <MediaKindIcon kind={entry.kind}></MediaKindIcon>
  <ul>
    {#each facts as fact (fact)}
      <li>{fact}</li>
    {/each}
  </ul>
</article>

<style>
  :root {
    --that-gap: 0.5rem;
  }
  .facts {
    font-size: 0.8rem;
    padding: 0.2rem 0;
    display: flex;
    align-items: center;
    gap: var(--that-gap);
  }
  .facts ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--that-gap);
  }

  .facts ul li {
    display: inline-block;
  }
</style>
