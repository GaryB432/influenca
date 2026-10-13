<script lang="ts">
  import { enhance } from "$app/forms";
  import { formatDuration, type ManifestEntry } from "@influenca/core";

  let { data, form } = $props();
  const { files, run, summary } = $derived(data);
  const deleted = $derived(files.filter((f) => f.entry.deleted).length);
  let captionsShown = $state<Record<string, boolean>>({});
  let videoElements = $state<Record<string, HTMLVideoElement | undefined>>({});

  function toggleCaptions(id: string) {
    const showing = !(captionsShown[id] ?? true);
    captionsShown[id] = showing;
    const track = videoElements[id]?.textTracks[0];
    if (track) track.mode = showing ? "showing" : "disabled";
  }

  /**
   * Holds a video's thumbnail and metadata back until its card is near the screen. A run
   * can hold dozens of clips, and a browser only keeps a few connections open to one
   * server, so asking for all of them at once makes the ones in view wait their turn.
   */
  function whenNear(video: HTMLVideoElement, poster: string | undefined) {
    const near = new IntersectionObserver(
      ([card]) => {
        if (!card?.isIntersecting) return;
        if (poster) video.poster = poster;
        video.preload = "metadata";
        near.disconnect();
      },
      // Early enough that a card is ready, and has taken its full height, before it scrolls in.
      { rootMargin: "600px 0px" },
    );
    near.observe(video);
    return { destroy: () => near.disconnect() };
  }

  function facts(e: ManifestEntry): string[] {
    const { analysis: a = {}, transcript: t } = e;
    const share = (sec: number, of: number) =>
      `${Math.round((sec / of) * 100)}%`;
    return [
      e.kind,
      ...(e.kind === "image" ? [] : [formatDuration(e.durationSec)]),
      ...(e.width && e.height ? [`${e.width}×${e.height}`] : []),
      ...(e.kind === "image" || a.stillSec === undefined
        ? []
        : [`still ${share(a.stillSec, e.durationSec)}`]),
      ...(e.kind === "image" || a.silentSec === undefined
        ? []
        : [`silent ${share(a.silentSec, e.durationSec)}`]),
      ...(t?.status === "done" ? [`${t.words} words (${t.language})`] : []),
      ...(t?.status === "silent" ? ["nothing to hear"] : []),
      ...(t?.status === "failed" ? ["transcript failed"] : []),
      ...(e.metaSource === "estimated" ? ["estimated"] : []),
    ];
  }
</script>

<svelte:head><title>{run} · Influenca</title></svelte:head>

<p class="back"><a href="/">All runs</a></p>
<h1>{run}</h1>
<p class="totals">
  {summary.counts.video} video, {summary.counts.audio}
  audio, {summary.counts.image} images.
  {summary.totalFrames} frames, {formatDuration(summary.totalDurationSec)}.
  {#if summary.estimated}Files that could not be probed show estimated frames
    and durations.{/if}
  {#if deleted}{deleted} marked deleted.{/if}
</p>
{#if form?.message}<p class="problem">{form.message}</p>{/if}

{#each files as { entry: e, poster, said, src, vttSrc } (e.id)}
  <article class:deleted={e.deleted}>
    <div class="media">
      {#if e.kind === "video"}
        <!-- Starts with nothing fetched. Near the screen it gets its thumbnail and enough metadata to show its length; the picture itself waits for play. -->
        <!-- svelte-ignore a11y_media_has_caption (a file that was not transcribed has none to offer) -->
        <video
          bind:this={videoElements[e.id]}
          controls
          preload="none"
          {src}
          use:whenNear={poster}
        >
          {#if vttSrc}
            <track default kind="captions" label="Transcript" src={vttSrc} />
          {/if}
        </video>
        {#if vttSrc}
          <button
            aria-label={(captionsShown[e.id] ?? true)
              ? "Turn captions off"
              : "Turn captions on"}
            aria-pressed={captionsShown[e.id] ?? true}
            class="vtt-overlay-toggle"
            onclick={() => toggleCaptions(e.id)}
            type="button">CC</button
          >
        {/if}
      {:else if e.kind === "audio"}
        <audio controls preload="none" {src}></audio>
      {:else}
        <img alt={e.outputName} loading="lazy" {src} />
      {/if}
    </div>
    <div class="about">
      <h2><span class="id">{e.id}</span>{e.title ?? e.outputName}</h2>
      {#if e.title}
        <p class="from">
          {e.outputName}
        </p>
      {/if}
      {#if e.sourceName !== e.outputName}
        <p class="from">
          from {e.sourceName}
        </p>
      {/if}
      <p class="facts">{facts(e).join(" · ")}</p>

      {#if said}
        <p class="said">{said}</p>
      {/if}

      <form
        action="?/update"
        method="POST"
        use:enhance={() =>
          ({ update }) =>
            update({ reset: false })}
      >
        <input name="id" type="hidden" value={e.id} />
        <input
          aria-label="Title for {e.outputName}"
          name="title"
          placeholder="Give it a title"
          value={e.title ?? ""}
        />
        <button>Save</button>
      </form>
      <!-- Only marks the manifest entry; the file stays in the run folder. -->
      <form action="?/update" method="POST" use:enhance>
        <input name="id" type="hidden" value={e.id} />
        <input
          name="deleted"
          type="hidden"
          value={e.deleted ? "false" : "true"}
        />
        {#if e.deleted}<span class="mark">Deleted</span>{/if}
        <button>{e.deleted ? "Restore" : "Delete"}</button>
      </form>
    </div>
  </article>
{/each}

<style>
  .back {
    margin: 0;
  }
  .totals,
  .from,
  .facts {
    color: light-dark(#555, #aaa);
  }
  article {
    display: grid;
    gap: 0.75rem 1.25rem;
    padding: 1.25rem 0;
    border-top: 1px solid light-dark(#ddd, #333);
  }
  @media (min-width: 44rem) {
    article {
      grid-template-columns: 22rem 1fr;
    }
  }
  video,
  img {
    display: block;
    width: 100%;
    max-height: 24rem;
    object-fit: contain;
    background: #000;
    border-radius: 0.3rem;
  }
  .media {
    position: relative;
  }
  .vtt-overlay-toggle {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: 0;
    border-radius: 4px;
    color: white;
    background: rgb(0 0 0 / 60%);
    backdrop-filter: blur(4px);
    font-size: 12px;
    cursor: pointer;
  }
  .vtt-overlay-toggle[aria-pressed="true"] {
    background: rgb(0 0 0 / 80%);
  }
  audio {
    width: 100%;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
    overflow-wrap: anywhere;
  }
  /* The number a file goes by in the CLI. */
  .id {
    display: inline-block;
    min-width: 1.5rem;
    margin-right: 0.5rem;
    padding: 0 0.3rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: light-dark(#fff, #16181a);
    background: light-dark(#555, #aaa);
    border-radius: 0.3rem;
  }
  .from,
  .facts {
    margin: 0.2rem 0 0;
    font-size: 0.9rem;
  }
  .from {
    background-color: whitesmoke;
  }

  /* Still there to play and to restore, but out of the way. */
  .deleted .media,
  .deleted .about > :not(form) {
    opacity: 0.4;
  }
  form {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin-top: 0.7rem;
  }
  form button,
  form input[name="title"] {
    font: inherit;
  }
  form input[name="title"] {
    flex: 1;
    min-width: 0;
    max-width: 22rem;
    padding: 0.2rem 0.4rem;
  }
  .mark {
    font-size: 0.9rem;
    color: light-dark(#a33, #e88);
  }
  .problem {
    color: light-dark(#a33, #e88);
  }
  .said {
    max-height: 9rem;
    margin: 0.6rem 0 0;
    overflow-y: auto;
  }
</style>
