<script lang="ts">
  import type { ManifestEntry } from "@influenca/core";

  interface Props {
    captionsShown: Record<string, boolean>;
    entry: ManifestEntry;
    toggleCaptions: (id: string) => void;
  }

  let { captionsShown, entry, toggleCaptions }: Props = $props();
</script>

<button
  aria-label={(captionsShown[entry.id] ?? true)
    ? "Turn captions off"
    : "Turn captions on"}
  aria-pressed={captionsShown[entry.id] ?? true}
  class="vtt-overlay-toggle"
  onclick={() => toggleCaptions(entry.id)}
  type="button">CC</button
>

<style>
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
  .vtt-overlay-toggle::after {
    content: "";
    position: absolute;
    right: 8px;
    bottom: 2px;
    left: 8px;
    height: 2px;
    background: #f00;
    transform: scaleX(0);
    transition: transform 150ms ease;
  }
  .vtt-overlay-toggle[aria-pressed="true"]::after {
    transform: scaleX(1);
  }
</style>
