<script lang="ts">
  import { resolve } from "$app/paths";


  let { data } = $props();

  let selectedStamp = $state<string>();

</script>

<select bind:value={selectedStamp}>
  {#each data.stamps as stamp (stamp)}
    <option value={stamp}>{stamp}</option>
  {/each}
</select>
<a href={resolve("/[stamp]", { stamp: selectedStamp ?? "W" })}>view</a>
