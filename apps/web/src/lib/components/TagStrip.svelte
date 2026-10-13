<script lang="ts">
  import type { ManifestEntry } from "@influenca/core";

  interface Props {
    entry: ManifestEntry;
  }
  let { entry }: Props = $props();
</script>

<ul class="tag-strip">
  <li class="tag-pill">
    HTML5
    <button type="button" class="tag-delete-btn" aria-label="Delete HTML5 tag">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </li>

  <li class="tag-pill">
    CSS3
    <button type="button" class="tag-delete-btn" aria-label="Delete CSS3 tag">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </li>

  <li>
    <button type="button" class="tag-pill tag-pill--add">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Tag
    </button>
  </li>
</ul>

<style>
  .tag-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  /* Base Pill Container */
  .tag-pill {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 14px; /* Starts with generous, comfortable padding */
    border-radius: 999px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    background: #f3f4f6;
    border: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* When the user hovers over the pill, make room for the X */
  .tag-pill:hover {
    padding-right: 6px;
    background: #e5e7eb;
  }

  /* The Close / Delete Affordance Button */
  .tag-delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 0; /* Starts completely collapsed */
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    opacity: 0; /* Starts invisible */
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none; /* Can't accidentally click it while invisible */
  }

  /* Reveal the X explicitly on pill hover */
  .tag-pill:hover .tag-delete-btn {
    width: 20px; /* Expands to full size */
    margin-left: 6px;
    opacity: 1; /* Fades in */
    pointer-events: auto; /* Becomes active */
  }

  /* High-contrast danger warning when targeting the X specifically */
  .tag-delete-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .tag-pill--add {
    padding: 0 12px 0 10px;
    background: transparent;
    color: #2563eb;
    border: 1.5px dashed #bfdbfe;
    cursor: pointer;
    gap: 4px;
  }

  .tag-pill--add:hover {
    background: #eff6ff;
    border-color: #2563eb;
    color: #1d4ed8;
  }

  .tag-strip svg {
    display: block;
    flex-shrink: 0;
  }
</style>
