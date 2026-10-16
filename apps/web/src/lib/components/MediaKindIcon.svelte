<script lang="ts">
  interface Props {
    kind: "audio" | "image" | "video" | string; // Strict typing is nice!
  }

  let { kind }: Props = $props();
</script>

{#snippet dogearDocumentFrame()}
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
  <path d="M14 2v6h6" />
{/snippet}

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  height="2rem"
  width="2rem"
  stroke="currentColor"
  fill="none"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <g id="{kind}-file">
    {@render dogearDocumentFrame()}

    <!-- Dynamic inner paths based on kind -->
    {#if kind === "video"}
      <polygon points="10 11 10 17 15 14 10 11" />
    {:else if kind === "image"}
      <circle cx="9" cy="12" r="1" />
      <path d="m16 18-3.5-3.5a1 1 0 0 0-1.4 0L7 18" />
    {:else if kind === "audio"}
      <path d="M8 13v2 M11 11v6 M14 12v4 M16 14v1" />
    {/if}
  </g>
</svg>
