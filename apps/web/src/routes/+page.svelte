<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { formatDuration } from "@influenca/core";

  let { data } = $props();
</script>

<svelte:head><title>Influenca</title></svelte:head>

<h1>Influenca</h1>

<section>
  <article>
    {#if data.runs.length === 0}
      <p>
        No runs in <code>{data.root}</code> yet. Make one with
        <code>influenca accession</code>.
      </p>
    {:else}
      <label for="run">Runs in <code>{data.root}</code></label>
      <select
        id="run"
        onchange={(e) => goto(resolve(e.currentTarget.value as "/"))}
      >
        <option value="" disabled selected
          >Choose from {data.runs.length}…</option
        >
        {#each data.runs as r (r.href)}
          {@const files =
            r.summary.counts.video +
            r.summary.counts.audio +
            r.summary.counts.image}
          <option value={r.href}>
            {r.name} · {files}
            {files === 1 ? "file" : "files"} · {formatDuration(
              r.summary.totalDurationSec,
            )}
          </option>
        {/each}
      </select>
    {/if}
  </article>
</section>

<style>
  section {
    display: flex;
    justify-content: center;
  }
  article {
    display: flex;
    flex-direction: column;
    width: 50dvw;
  }
</style>
