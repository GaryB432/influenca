<script lang="ts">
  import { goto } from "$app/navigation";
  import { formatDuration } from "@influenca/core";

  let { data } = $props();
</script>

<svelte:head><title>Influenca</title></svelte:head>

<main>
  <h1>Influenca</h1>
  {#if data.runs.length === 0}
    <p>
      No runs in <code>{data.root}</code> yet. Make one with
      <code>influenca accession</code>.
    </p>
  {:else}
    <label for="run">Runs in <code>{data.root}</code></label>
    <select id="run" onchange={(e) => goto(e.currentTarget.value)}>
      <option value="" disabled selected>Choose from {data.runs.length}…</option>
      {#each data.runs as r (r.href)}
        {@const files = r.summary.counts.video + r.summary.counts.audio + r.summary.counts.image}
        <option value={r.href}>
          {r.name} · {files} {files === 1 ? "file" : "files"} · {formatDuration(r.summary.totalDurationSec)}
        </option>
      {/each}
    </select>
  {/if}
</main>
