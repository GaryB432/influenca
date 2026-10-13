<script lang="ts">
  import type { ManifestEntry } from "@influenca/core";

  interface Props {
    entry: ManifestEntry;
  }

  let { entry }: Props = $props();

  let initialTags = $derived(entry.tags || []);
  let tags = $derived<string[]>(initialTags);

  let suggestions = $state([
    "Accessibility",
    "Animation",
    "Backend",
    "Build Tools",
    "Deployment",
    "Design Systems",
    "Frontend",
    "JavaScript",
    "Responsive Design",
    "TypeScript",
    "Web History",
  ]);

  let focusedIndex = $state<number>(-1);
  let inputValue = $state<string>("");
  let showDropdown = $state<boolean>(false);

  // 4. Automated reactive compiler loop derivation
  let filteredSuggestions = $derived<string[]>(
    suggestions.filter(
      (item: string) =>
        !tags.includes(item) &&
        item.toLowerCase().includes(inputValue.toLowerCase()),
    ),
  );

  // 5. Explicitly typed layout functions
  function addTag(tagName: string): void {
    const cleanName: string = tagName.trim();
    if (cleanName && !tags.includes(cleanName)) {
      tags = [...tags, cleanName];
    }
    focusedIndex = -1;
    inputValue = "";
  }

  function handleKeyDown(event: KeyboardEvent): void {
    // If input line text buffer is active, default typing passes out natively
    if (inputValue.length > 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        addTag(inputValue);
      }
      focusedIndex = -1;
      return;
    }

    // Keyboard backspace delete loop execution
    if (event.key === "Backspace") {
      if (focusedIndex === -1 && tags.length > 0) {
        focusedIndex = tags.length - 1; // Select the final pill item
      } else if (focusedIndex >= 0) {
        event.preventDefault();
        tags = tags.filter((_, i: number) => i !== focusedIndex);
        focusedIndex = tags.length > 0 ? tags.length - 1 : -1;
      }
      return;
    }

    // Linear arrow key focus navigations
    if (event.key === "ArrowLeft" && focusedIndex > 0) {
      event.preventDefault();
      focusedIndex -= 1;
    } else if (event.key === "ArrowRight") {
      if (focusedIndex >= 0 && focusedIndex < tags.length - 1) {
        event.preventDefault();
        focusedIndex += 1;
      } else {
        focusedIndex = -1; // Hand control focus back to layout cursor
      }
    }

    // Escape hides open popup modules
    if (event.key === "Escape") {
      focusedIndex = -1;
      showDropdown = false;
    }
  }
</script>

<div class="tag-system">
  <!-- Interactive Pill Strip Box Wrapper -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="tag-input-container"
    tabindex="0"
    onfocusin={() => (showDropdown = true)}
    onfocusout={(event: FocusEvent) => {
      const target = event.currentTarget as HTMLElement;
      // Small timeout allows button click tracking to process before component blur
      setTimeout(() => {
        if (!target.contains(document.activeElement)) {
          focusedIndex = -1;
          showDropdown = false;
        }
      }, 150);
    }}
    onkeydown={handleKeyDown}
  >
    <ul class="tag-strip">
      {#each tags as tag, index (tag)}
        <li>
          <button
            type="button"
            class="tag-pill"
            class:is-focused={focusedIndex === index}
            onclick={() => (focusedIndex = index)}
          >
            {tag}
          </button>
        </li>
      {/each}

      <!-- Dynamic Text Input insertion slot within the list flow -->
      <li class="input-li">
        <input
          type="text"
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          onfocus={() => (focusedIndex = -1)}
          bind:value={inputValue}
        />
      </li>
    </ul>

    <!-- Context Floating Suggestion Dropdown List -->
    {#if showDropdown && filteredSuggestions.length > 0}
      <div class="suggestions-dropdown">
        <div class="dropdown-header">Suggested Tags</div>
        <ul>
          {#each filteredSuggestions as suggestion (suggestion)}
            <li>
              <button type="button" onclick={() => addTag(suggestion)}>
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
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                {suggestion}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</div>

<style>
  .tag-system {
    position: relative;
    display: inline-block;
    width: 100%;
    max-width: 480px;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .tag-input-container {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: #ffffff;
    outline: none;
    transition: all 0.15s ease;
  }

  .tag-input-container:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
  }

  .tag-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 0;
    margin: 0;
    list-style: none;
    width: 100%;
  }

  .tag-pill {
    display: inline-flex;
    align-items: center;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    background: #f3f4f6;
    border: 2px solid transparent;
    cursor: pointer;
    user-select: none;
    transition: all 0.1s ease;
  }

  .tag-pill.is-focused {
    background: #fee2e2;
    border-color: #ef4444;
    color: #991b1b;
  }

  .input-li {
    flex-grow: 1;
    display: inline-flex;
  }

  .input-li input {
    width: 100%;
    min-width: 60px;
    height: 28px;
    border: none;
    outline: none;
    font-size: 13px;
    color: #111827;
    background: transparent;
    padding: 0 4px;
  }

  .suggestions-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -4px rgba(0, 0, 0, 0.1);
    z-index: 50;
    overflow: hidden;
  }

  .dropdown-header {
    padding: 8px 12px 4px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: #9ca3af;
    letter-spacing: 0.05em;
  }

  .suggestions-dropdown ul {
    margin: 0;
    padding: 4px 0;
    list-style: none;
    max-height: 200px;
    overflow-y: auto;
  }

  .suggestions-dropdown button {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: #374151;
    text-align: left;
    cursor: pointer;
  }

  .suggestions-dropdown button:hover {
    background: #f3f4f6;
    color: #2563eb;
  }

  svg {
    color: #9ca3af;
    transition: color 0.1s ease;
  }

  .suggestions-dropdown button:hover svg {
    color: #2563eb;
  }
</style>
