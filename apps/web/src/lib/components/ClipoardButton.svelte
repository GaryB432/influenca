<script lang="ts">
  interface Props {
    path: string;
  }

  let bcopied = $state(false);

  async function copy(path: string) {
    await navigator.clipboard.writeText(path);
    bcopied = true;
    setTimeout(() => {
      bcopied = false;
    }, 1500);
  }

  let { path }: Props = $props();
</script>

<p class="path">
  <code>{path}</code>
  <button onclick={() => copy(path)}>
    {bcopied ? "Copied" : "Copy"}
  </button>
</p>

<style>
  .path {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin: 0.3rem 0 0;
    font-size: 0.85rem;
  }
  .path code {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .path button {
    flex: none;
    min-width: 4rem;
    font: inherit;
  }
</style>
