<script lang="ts">
  import { formatDuration } from "@influenca/core";

  let { data } = $props();
  const { manifest, run, summary } = $derived(data);
</script>

<svelte:head><title>{run} · Influenca</title></svelte:head>

<main>
  <h1>{run}</h1>
  <p class="totals">
    {summary.counts.video} video, {summary.counts.audio} audio, {summary.counts.image} images.
    {summary.totalFrames} frames, {formatDuration(summary.totalDurationSec)}.
    {#if summary.estimated}Files that could not be probed show estimated frames and durations.{/if}
  </p>

  <table>
    <thead>
      <tr><th>File</th><th>Type</th><th>Frames</th><th>Duration</th></tr>
    </thead>
    <tbody>
      {#each manifest.entries as e (e.id)}
        <tr>
          <td>{e.outputName}</td>
          <td>{e.kind}</td>
          <td>{e.kind === "audio" ? "" : e.frameCount}</td>
          <td>{e.kind === "image" ? "" : formatDuration(e.durationSec)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</main>

<style>
  :global(body) {
    margin: 0;
    font: 16px/1.5 system-ui, sans-serif;
    color: light-dark(#1d1f21, #e6e6e6);
    background: light-dark(#fff, #16181a);
    color-scheme: light dark;
  }
  main {
    max-width: 52rem;
    margin: 3rem auto;
    padding: 0 1rem;
  }
  h1 {
    font-size: 1.4rem;
    overflow-wrap: anywhere;
  }
  .totals {
    color: light-dark(#555, #aaa);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 0.4rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid light-dark(#ddd, #333);
  }
  td:nth-child(n + 3),
  th:nth-child(n + 3) {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
