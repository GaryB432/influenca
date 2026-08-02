<script lang="ts">
  import { resolve } from "$app/paths";

  let { data } = $props();

  let selectedStamp = $state<string>();
</script>

<svg style="display: none;">
  <symbol id="icon-folder" viewBox="0 0 24 24">
    <path
      d="M22 19V7a2 2 0 0 0-2-2h-7.17l-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </symbol>
</svg>

{#snippet figure()}
  <svg
    class="folder-icon"
    xmlns="http://w3.org"
    viewBox="0 0 24 24"
    width="16"
    height="16"
  >
    <path
      d="M22 19V7a2 2 0 0 0-2-2h-7.17l-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"
      fill="#3b82f6"
      stroke="#2563eb"
      stroke-width="2"
      stroke-linejoin="round"
    />
  </svg>
{/snippet}

<select name="folder-select" class="folder-select" bind:value={selectedStamp}>
  {#each data.stamps as stamp (stamp)}
    <option value={stamp}>
      {@render figure()}
      <span>
        {stamp}
      </span>
    </option>
  {/each}
</select>
<a href={resolve("/[stamp]", { stamp: selectedStamp ?? "W" })}>view</a>
