<script lang="ts">
  import type { ManifestEntry } from "@influenca/core";

  interface Props {
    entry: ManifestEntry;
  }
  let { entry }: Props = $props();
</script>

<article>
  {#if entry.tags}
    {entry.tags.length}
  {:else}
    ain't got no
  {/if}
</article>

<style>
  article {
    --some-color: rgba(0, 0, 0, 0.2);
    display: grid;
    grid-template-columns: 1fr 1fr;
    box-shadow:
      0 2px 2px 0 var(--some-color),
      0 12px 22px 0 var(--some-color);
    max-width: 50vw;
    outline: 1px solid var(--some-color);
    overflow: hidden;
    padding: 0.5em;
  }
</style>
