<script lang="ts">
  interface Props {
    kind: string;
  }

  let { kind }: Props = $props();
</script>

{#if kind === "video"}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width="100%"
    height="100%"
  >
    <!-- Background Circle (Slightly filled like an empty avatar slot) -->
    <circle
      cx="256"
      cy="256"
      r="240"
      fill="#E2E8F0"
      stroke="#94A3B8"
      stroke-width="24"
    />

    <!-- "COMING SOON" Placeholder Text -->
    <text
      x="50%"
      y="44%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-weight="800"
      font-size="64px"
      letter-spacing="2px"
      fill="#64748B"
    >
      {kind.toUpperCase()}
    </text>
    <text
      x="50%"
      y="60%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-weight="800"
      font-size="64px"
      letter-spacing="2px"
      fill="#64748B"
    >
      SOON
    </text>
  </svg>
{:else if kind === "image"}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width="100%"
    height="100%"
  >
    <!-- Background Circle (Slightly filled like an empty avatar slot) -->
    <circle
      cx="256"
      cy="256"
      r="240"
      fill="#E2E8F0"
      stroke="#94A3B8"
      stroke-width="24"
    />

    <!-- "COMING SOON" Placeholder Text -->
    <text
      x="50%"
      y="44%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-weight="800"
      font-size="64px"
      letter-spacing="2px"
      fill="#64748B"
    >
      {kind.toUpperCase()}
    </text>
    <text
      x="50%"
      y="60%"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-weight="800"
      font-size="64px"
      letter-spacing="2px"
      fill="#64748B"
    >
      SOON
    </text>
  </svg>{:else if kind === "audio"}
  <p>Unsupported.</p>
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
