<script lang="ts">
  import Footer from "#lib/components/Footer.svelte";
  import Header from "#lib/components/Header.svelte";

  import type { LayoutProps } from "./$types";

  import "./layout.css";

  let { children }: LayoutProps = $props();
</script>

<Header />
<div class="app">
  <main>
    {@render children()}
  </main>
</div>
<Footer />

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    width: 100%;
    max-width: 75dvw;
    margin: 0 auto;
  }
</style>
