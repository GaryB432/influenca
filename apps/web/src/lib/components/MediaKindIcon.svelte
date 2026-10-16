<script lang="ts">
  interface Props {
    kind: string;
  }

  let { kind }: Props = $props();
</script>

{#if kind === "video"}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <g id="video-file">
      <!-- Document/File Frame -->
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <!-- Play Button -->
      <polygon points="10 11 10 17 15 14 10 11" />
    </g>
  </svg>
{:else if kind === "image"}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <g id="image-file">
      <!-- Document/File Frame -->
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <!-- Mountain/Sun Photo Symbol -->
      <circle cx="9" cy="12" r="1" />
      <path d="m16 18-3.5-3.5a1 1 0 0 0-1.4 0L7 18" />
    </g>
  </svg>
{:else if kind === "audio"}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <g id="audio-file">
      <!-- Document/File Frame -->
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <!-- Audio Waveform -->
      <path d="M8 13v2" />
      <path d="M11 11v6" />
      <path d="M14 12v4" />
      <path d="M16 14v1" />
    </g>
  </svg>
{:else}
  <p>Unknown kind.</p>
{/if}

<style>
  svg {
    border: thin solid silver;
    height: 2rem;
    width: 2rem;
  }
</style>
